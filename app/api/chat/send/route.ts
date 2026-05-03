import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readFile } from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions, resolveModelGovernanceRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  applyFirstTurnTitleFallback,
  charEstimateFromMessages,
  finalizeAssistantMessage,
  prepareOrchestrator,
} from "@/lib/orchestration/chatOrchestrator";
import { chatSendNeedsLongContextHeuristic } from "@/lib/chatAgentModelRules";
import { checkRateLimit } from "@/lib/rateLimit";
import { streamChatCompletion, type StreamUsageSink } from "@/lib/openai/client";
import { assertGovernedModelSessionAccessible } from "@/lib/agentModelGovernance";
import { assertUserWithinSoftTokenLimit, assertModelAccessForRole, getGovernedModelsForUser } from "@/lib/usage";
import { resolveModelById } from "@/lib/models";
import type { ModelProvider, UserRole } from "@/lib/models";
import { validateSendTimeModelPreferences } from "@/lib/chatAgentModelRules";
import { captureError } from "@/lib/sentry";
import { logJson } from "@/lib/logger";
import { effectiveRequiresStructuredOutput } from "@/lib/agentModelPolicy";
import { governedOptionsToUiSummaries, routeModel } from "@/lib/modelRouter";
import type { RouterMode } from "@/lib/modelRoutingTypes";
import { classifyChatError } from "@/lib/chatErrorTaxonomy";
import { markRecentRateLimit } from "@/lib/modelHealthHints";
import { buildEffectiveAgentConfig } from "@/lib/agentEffectiveConfig";
import { toKnowledgeInjectionTelemetry } from "@/lib/knowledgeInjection";

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

async function toBase64DataUri(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;
  const filePath = path.join(process.cwd(), "public", url);
  const buffer = await readFile(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = MIME_MAP[ext] ?? "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/** User-safe text for SSE `error` events (no stack traces). */
function sseErrorMessageForClient(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("LLM request failed")) {
    if (raw.includes("401") || raw.includes("Unauthorized")) {
      return "AI API rejected the request. Check OPENAI_API_KEY / GROQ_API_KEY on the server.";
    }
    if (raw.includes("429")) {
      return "AI provider rate limit reached for the current workspace key. Wait briefly, send one request at a time, or switch to another available model.";
    }
    if (raw.includes("400") || raw.includes("invalid")) {
      return "The AI provider rejected this request (prompt, image, or model). Try a smaller image or different model.";
    }
    return raw.length <= 320 ? raw : "The AI provider returned an error. Try again.";
  }
  if (raw.includes("ENOENT") || raw.toLowerCase().includes("no such file")) {
    return "Could not load an attached image. Re-upload and try again.";
  }
  if (raw.includes("does not support image inputs")) return raw;
  if (raw.includes("No API key configured")) return raw;
  if (raw.includes("Streaming failed")) return raw;
  return "An error occurred while generating the response.";
}

function isAbortLike(error: unknown): boolean {
  const name = typeof error === "object" && error && "name" in error ? String((error as { name?: unknown }).name ?? "") : "";
  if (name === "AbortError") return true;
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : String(error ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("abort") ||
    lower.includes("aborted") ||
    lower.includes("cancelled") ||
    lower.includes("canceled") ||
    lower.includes("client disconnected")
  );
}

function isConflictLike(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = typeof (error as { code?: unknown }).code === "string" ? String((error as { code?: unknown }).code) : "";
  const m = error.message.toLowerCase();
  return (
    error.message === "ACTIVE_TURN_ATTEMPT" ||
    code === "P2034" ||
    m.includes("write conflict") ||
    m.includes("deadlock") ||
    m.includes("serialization")
  );
}

const sendSchema = z.object({
  sessionId: z.string().min(1),
  agentId: z.string().min(1),
  text: z.string().min(1),
  imageUrls: z.array(z.string().min(1)).optional(),
  editedFromId: z.string().optional(),
  regenOfId: z.string().optional(),
  turnId: z.string().optional(),
  retryOfAssistantMessageId: z.string().optional(),
  modelVersion: z.string().optional(),
  modelRoutingMode: z.enum(["manual", "auto", "suggested"]).optional(),
});

export async function POST(req: NextRequest) {
  const start = Date.now();
  let userIdForLogs = "unknown";
  let assistantAttemptId: string | null = null;
  let requestKind: "send" | "retry" = "send";
  let selectedModelIdForAttempt: string | null = null;
  let selectedProviderForAttempt: ModelProvider | null = null;
  let titleFallbackContext: { sessionId: string; seedText: string } | null = null;
  const maybeApplyFirstTurnTitleFallback = async () => {
    if (!titleFallbackContext) return;
    if (requestKind !== "send") return;
    await applyFirstTurnTitleFallback({
      userId: userIdForLogs,
      sessionId: titleFallbackContext.sessionId,
      seedText: titleFallbackContext.seedText,
    });
  };
  const finalizeAttemptFailed = async (id: string, cause: unknown) => {
    const clientMessage =
      typeof cause === "string" && cause.trim().length > 0
        ? cause.trim()
        : sseErrorMessageForClient(cause);
    const classified = classifyChatError(clientMessage);
    await db.message.update({
      where: { id },
      data: {
        deliveryStatus: "FAILED",
        failedAt: new Date(),
        errorCode: classified.code,
        errorMessage: classified.detail,
      },
    });
    if (classified.code === "rate_limit") {
      markRecentRateLimit({
        modelId: selectedModelIdForAttempt,
        provider: selectedProviderForAttempt,
      });
    }
    logJson("error", {
      route: "/api/chat/send",
      userId: userIdForLogs,
      status: "attempt_failed",
      requestKind,
      assistantAttemptId: id,
      errorCode: classified.code,
      errorDetail: classified.detail,
    });
  };
  const finalizeAttemptCancelled = async (id: string) => {
    await db.message.updateMany({
      where: {
        id,
        deliveryStatus: { in: ["PENDING", "STREAMING"] },
      },
      data: {
        deliveryStatus: "CANCELLED",
        completedAt: null,
        failedAt: null,
        errorCode: null,
        errorMessage: null,
      },
    });
  };
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;
    const userRole = resolveModelGovernanceRole({
      platformRole: (session.user.role ?? "USER") as "USER" | "TEAM_LEAD" | "ADMIN",
      workspaceRole: session.user.workspaceRole,
    });
    const teamId = session.user.teamId ?? null;
    userIdForLogs = userId;
    const limit = await checkRateLimit({
      userId,
      endpoint: "/api/chat/send",
      limit: 20,
      windowSec: 60,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const payload = sendSchema.parse(await req.json());
    titleFallbackContext = {
      sessionId: payload.sessionId,
      seedText: payload.text,
    };

    let retrySource:
      | {
          id: string;
          turnId: string | null;
          deliveryStatus: "PENDING" | "STREAMING" | "FAILED" | "COMPLETED" | "CANCELLED";
        }
      | null = null;
    if (payload.retryOfAssistantMessageId) {
      requestKind = "retry";
      const source = await db.message.findFirst({
        where: {
          id: payload.retryOfAssistantMessageId,
          sessionId: payload.sessionId,
          userId,
          role: "assistant",
        },
        select: {
          id: true,
          turnId: true,
          deliveryStatus: true,
        },
      });
      if (!source || source.deliveryStatus !== "FAILED") {
        return NextResponse.json(
          { error: "Retry target must be a failed assistant message in this conversation." },
          { status: 400 }
        );
      }
      retrySource = source;
    }
    const effectiveTurnId = payload.turnId?.trim() || retrySource?.turnId || crypto.randomUUID();

    const activeAttempt = await db.message.findFirst({
      where: {
        sessionId: payload.sessionId,
        userId,
        role: "assistant",
        turnId: effectiveTurnId,
        deliveryStatus: { in: ["PENDING", "STREAMING"] },
      },
      select: { id: true },
    });
    if (activeAttempt) throw new Error("ACTIVE_TURN_ATTEMPT");

    const { models: governedModels, snapshot } = await getGovernedModelsForUser({
      userId,
      userRole: userRole as "USER" | "TEAM_LEAD" | "ADMIN",
      teamId,
      additionalEstimatedTokens: Math.ceil(payload.text.length / 4) + 1200,
    });

    await assertUserWithinSoftTokenLimit({
      userId,
      additionalEstimatedTokens: Math.ceil(payload.text.length / 4) + 1200,
      userRole,
      teamId,
    });

    const hasImages = Boolean(payload.imageUrls && payload.imageUrls.length > 0);
    const resolvedImageUrls = hasImages
      ? await Promise.all(payload.imageUrls!.map(toBase64DataUri))
      : undefined;

    const prepared = await prepareOrchestrator({
      userId,
      ...payload,
      turnId: effectiveTurnId,
      skipUserInsert: Boolean(retrySource),
      resolvedImageUrls,
    });

    const assistantAttempt = await db.$transaction(
      async (tx) => {
        const conflict = await tx.message.findFirst({
          where: {
            sessionId: payload.sessionId,
            userId,
            role: "assistant",
            turnId: effectiveTurnId,
            deliveryStatus: { in: ["PENDING", "STREAMING"] },
          },
          select: { id: true },
        });
        if (conflict) throw new Error("ACTIVE_TURN_ATTEMPT");

        const attemptCursor = await tx.message.findFirst({
          where: {
            sessionId: payload.sessionId,
            userId,
            role: "assistant",
            turnId: effectiveTurnId,
          },
          orderBy: [{ attemptIndex: "desc" }, { createdAt: "desc" }],
          select: { attemptIndex: true },
        });
        const nextAttemptIndex = (attemptCursor?.attemptIndex ?? 0) + 1;

        return tx.message.create({
          data: {
            sessionId: payload.sessionId,
            userId,
            role: "assistant",
            content: "",
            agentConfigId: null,
            turnId: effectiveTurnId,
            retryOfAssistantMessageId: retrySource?.id,
            attemptIndex: nextAttemptIndex,
            model: payload.modelVersion ?? null,
            provider: null,
            deliveryStatus: "PENDING",
            startedAt: new Date(),
          },
        });
      },
      { isolationLevel: "Serializable" }
    );
    assistantAttemptId = assistantAttempt.id;
    const cancelOnClientAbort = () => {
      void finalizeAttemptCancelled(assistantAttempt.id).catch(() => {
        // Best effort: client disconnected after attempt creation.
      });
    };
    if (req.signal.aborted) {
      cancelOnClientAbort();
    } else {
      req.signal.addEventListener("abort", cancelOnClientAbort, { once: true });
    }

    const effective = buildEffectiveAgentConfig(prepared.agent);
    const governedUi = governedOptionsToUiSummaries(governedModels);
    const routingMode = (payload.modelRoutingMode ?? "manual") as RouterMode;
    const budgetPressure = snapshot.user.status === "warning" ? "warning" : "ok";
    const needsLongContextHeuristic = chatSendNeedsLongContextHeuristic(payload.text.length);

    const decision = routeModel({
      routingMode,
      userSelectedModelId: payload.modelVersion?.trim() || null,
      governedModels: governedUi,
      modelPreferences: effective.modelPreferences,
      outputFormat: prepared.agent.outputFormat,
      userRole: userRole as UserRole,
      budgetPressure,
      textLength: payload.text.length,
      needsVision: hasImages,
      needsStructuredOutput: effectiveRequiresStructuredOutput(
        effective.modelPreferences,
        prepared.agent.outputFormat
      ),
      needsLongContextHeuristic,
    });

    if (decision.blocked || !decision.selectedModelId) {
      await finalizeAttemptFailed(
        assistantAttempt.id,
        decision.blockReason ?? "No compatible model for this request."
      );
      await maybeApplyFirstTurnTitleFallback();
      return NextResponse.json(
        { error: decision.blockReason ?? "No compatible model for this request." },
        { status: 400 }
      );
    }

    const effectiveModelId = decision.selectedModelId;

    assertModelAccessForRole(effectiveModelId, userRole);
    assertGovernedModelSessionAccessible(effectiveModelId, governedModels, userRole as UserRole);

    if (hasImages) {
      const model = resolveModelById(effectiveModelId);
      if (model && !model.capabilities.includes("vision")) {
        throw new Error(`${model.displayName} does not support image inputs. Select a Vision model.`);
      }
    }

    const selectedModel = resolveModelById(effectiveModelId);
    selectedModelIdForAttempt = effectiveModelId;
    selectedProviderForAttempt = selectedModel?.provider ?? null;
    if (selectedModel) {
      validateSendTimeModelPreferences({
        modelPreferences: effective.modelPreferences,
        outputFormat: prepared.agent.outputFormat,
        selectedModel,
        agentName: prepared.agent.name,
      });
    }

    logJson("info", {
      route: "/api/chat/send",
      userId,
      status: "model_selected",
      requestKind,
      sessionId: payload.sessionId,
      agentId: payload.agentId,
      requestedModelId: payload.modelVersion ?? null,
      selectedModelId: effectiveModelId,
      selectedProvider: selectedModel?.provider ?? null,
      routingMode: decision.mode,
      reasonCodes: decision.reasonCodes,
    });
    logJson("info", {
      route: "/api/chat/send",
      userId,
      status: "knowledge_injection",
      requestKind,
      sessionId: payload.sessionId,
      agentId: payload.agentId,
      knowledgeInjection: toKnowledgeInjectionTelemetry(prepared.knowledgeInjection),
    });

    await db.message.update({
      where: { id: assistantAttempt.id },
      data: {
        agentConfigId: prepared.agent.id,
        model: effectiveModelId,
        provider: selectedModel?.provider ?? null,
      },
    });

    const encoder = new TextEncoder();
    const usageSink: StreamUsageSink = {};
    const promptCharEstimate = charEstimateFromMessages(prepared.messages, payload.text);

    let cancelledByConsumer = false;
    const stream = new ReadableStream({
      async start(controller) {
        let output = "";
        let finalized = false;
        try {
          await db.message.update({
            where: { id: assistantAttempt.id },
            data: { deliveryStatus: "STREAMING" },
          });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                meta: {
                  assistantMessageId: assistantAttempt.id,
                  turnId: effectiveTurnId,
                  routedModelId: effectiveModelId,
                  routerMode: decision.mode,
                  reasonCodes: decision.reasonCodes,
                  suggestedModelId: decision.suggestedModelId,
                  taskClass: decision.taskClass,
                },
              })}\n\n`
            )
          );

          for await (const delta of streamChatCompletion(prepared.messages, {
            temperature: prepared.agent.temperature,
            maxTokens: prepared.agent.maxTokens,
            modelVersion: effectiveModelId,
            hasImages,
            usageSink,
            promptCharEstimate,
          })) {
            output += delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }

          await finalizeAssistantMessage({
            userId,
            sessionId: payload.sessionId,
            agentId: payload.agentId,
            text: payload.text,
            responseText: output,
            messages: prepared.messages,
            modelVersion: effectiveModelId,
            registryModelId: effectiveModelId,
            usage: usageSink.normalized ?? null,
            routerDecision: decision,
            assistantMessageId: assistantAttempt.id,
            providerHint: selectedModel?.provider ?? null,
          });
          finalized = true;
          logJson("info", {
            route: "/api/chat/send",
            userId,
            agentId: payload.agentId,
            tokensUsed: usageSink.normalized?.totalTokens ?? Math.ceil((payload.text.length + output.length) / 4),
            latencyMs: Date.now() - start,
            status: "success",
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Streaming failed during response generation.";
          if (isAbortLike(error)) {
            await finalizeAttemptCancelled(assistantAttempt.id);
            finalized = true;
            try {
              controller.close();
            } catch {
              // stream may already be closed
            }
            return;
          }
          const clientMessage = sseErrorMessageForClient(error);
          await finalizeAttemptFailed(assistantAttempt.id, error);
          await maybeApplyFirstTurnTitleFallback();
          finalized = true;
          captureError(error, { route: "/api/chat/send", userId });
          logJson("error", {
            route: "/api/chat/send",
            userId,
            agentId: payload.agentId,
            tokensUsed: Math.ceil((payload.text.length + output.length) / 4),
            latencyMs: Date.now() - start,
            status: "error",
            error: error instanceof Error ? { message: error.message, stack: error.stack } : message,
          });
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: clientMessage })}\n\n`)
          );
          controller.close();
        } finally {
          // If connection/stream lifecycle ends unexpectedly after start, ensure no active orphan remains.
          if (!finalized && !cancelledByConsumer) {
            await finalizeAttemptCancelled(assistantAttempt.id);
          }
        }
      },
      async cancel() {
        cancelledByConsumer = true;
        await finalizeAttemptCancelled(assistantAttempt.id);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (isConflictLike(error)) {
      return NextResponse.json(
        { error: "Another assistant attempt for this turn is already in progress." },
        { status: 409 }
      );
    }
    if (assistantAttemptId) {
      if (isAbortLike(error)) {
        await finalizeAttemptCancelled(assistantAttemptId);
      } else {
        await finalizeAttemptFailed(assistantAttemptId, error);
        await maybeApplyFirstTurnTitleFallback();
      }
    }
    captureError(error, { route: "/api/chat/send", userId: userIdForLogs });
    logJson("error", {
      route: "/api/chat/send",
      userId: userIdForLogs,
      tokensUsed: 0,
      latencyMs: Date.now() - start,
      status: "error",
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Unauthorized" ? 401
      : message.includes("Token soft limit") ? 403
      : 400;
    const isModelError =
      message.includes("does not support image inputs") ||
      message.includes("does not have access") ||
      message.includes("does not allow") ||
      message.includes("structured output support") ||
      message.includes("unavailable") ||
      message.includes("credentials");
    return NextResponse.json(
      { error: message === "Unauthorized" ? "Please sign in to continue."
        : message.includes("Token soft limit") ? "Monthly token limit reached. Please try again next month."
        : isModelError ? message
        : "Something went wrong. Please try again." },
      { status }
    );
  }
}
