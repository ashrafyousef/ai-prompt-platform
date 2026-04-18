import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readFile } from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { finalizeAssistantMessage, prepareOrchestrator } from "@/lib/orchestration/chatOrchestrator";
import { checkRateLimit } from "@/lib/rateLimit";
import { streamChatCompletion } from "@/lib/openai/client";
import { assertUserWithinSoftTokenLimit, assertModelAccessForRole, getGovernedModelsForUser } from "@/lib/usage";
import { resolveModelById } from "@/lib/models";
import { normalizeAgentInputSchema } from "@/lib/agentConfig";
import { captureError } from "@/lib/sentry";
import { logJson } from "@/lib/logger";

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

const sendSchema = z.object({
  sessionId: z.string().min(1),
  agentId: z.string().min(1),
  text: z.string().min(1),
  imageUrls: z.array(z.string().min(1)).optional(),
  editedFromId: z.string().optional(),
  regenOfId: z.string().optional(),
  modelVersion: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const start = Date.now();
  let userIdForLogs = "unknown";
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");
    const userId = session.user.id;
    const userRole = session.user.role ?? "USER";
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

    if (payload.modelVersion) {
      assertModelAccessForRole(payload.modelVersion, userRole);
      const { models } = await getGovernedModelsForUser({
        userId,
        userRole: userRole as "USER" | "TEAM_LEAD" | "ADMIN",
        teamId,
        additionalEstimatedTokens: Math.ceil(payload.text.length / 4) + 1200,
      });
      const selectedVisibleModel = models.find((model) => model.id === payload.modelVersion);
      if (selectedVisibleModel && !selectedVisibleModel.enabled) {
        throw new Error(
          selectedVisibleModel.disabledReason ?? `${selectedVisibleModel.displayName} is currently unavailable.`
        );
      }
    }

    const hasImages = Boolean(payload.imageUrls && payload.imageUrls.length > 0);
    if (hasImages && payload.modelVersion) {
      const model = resolveModelById(payload.modelVersion);
      if (model && !model.capabilities.includes("vision")) {
        throw new Error(`${model.displayName} does not support image inputs. Select a Vision model.`);
      }
    }

    await assertUserWithinSoftTokenLimit({
      userId,
      additionalEstimatedTokens: Math.ceil(payload.text.length / 4) + 1200,
      userRole,
      teamId,
    });

    const resolvedImageUrls = hasImages
      ? await Promise.all(payload.imageUrls!.map(toBase64DataUri))
      : undefined;

    const encoder = new TextEncoder();
    const prepared = await prepareOrchestrator({
      userId,
      ...payload,
      resolvedImageUrls,
    });

    if (payload.modelVersion) {
      const selectedModel = resolveModelById(payload.modelVersion);
      if (selectedModel) {
        const normalized = normalizeAgentInputSchema(prepared.agent.inputSchema);
        const behaviorMeta =
          normalized.meta.behavior &&
          typeof normalized.meta.behavior === "object"
            ? (normalized.meta.behavior as Record<string, unknown>)
            : {};
        const allowedModelIds = Array.isArray(behaviorMeta.allowedModelIds)
          ? behaviorMeta.allowedModelIds
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];
        const requiresStructuredOutput =
          (typeof behaviorMeta.requiresStructuredOutput === "boolean"
            ? behaviorMeta.requiresStructuredOutput
            : false) || prepared.agent.outputFormat !== "markdown";

        if (allowedModelIds.length > 0 && !allowedModelIds.includes(selectedModel.id)) {
          throw new Error(`${prepared.agent.name} does not allow ${selectedModel.displayName}.`);
        }
        if (requiresStructuredOutput && !selectedModel.capabilities.includes("structured_output")) {
          throw new Error(
            `${selectedModel.displayName} has weak structured output support for ${prepared.agent.name}.`
          );
        }
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        let output = "";
        try {
          for await (const delta of streamChatCompletion(prepared.messages, {
            temperature: prepared.agent.temperature,
            maxTokens: prepared.agent.maxTokens,
            modelVersion: payload.modelVersion,
            hasImages,
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
            modelVersion: payload.modelVersion,
          });
          logJson("info", {
            route: "/api/chat/send",
            userId,
            agentId: payload.agentId,
            tokensUsed: Math.ceil((payload.text.length + output.length) / 4),
            latencyMs: Date.now() - start,
            status: "success",
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Streaming failed during response generation.";
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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Internal server error" })}\n\n`));
          controller.close();
        }
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
