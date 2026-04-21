import { db } from "@/lib/db";
import { buildMessages, ChatMessage } from "@/lib/orchestration/buildMessages";
import { getOutputMode, requiresJsonOutput } from "@/lib/orchestration/agentContract";
import { validateStructuredOutput } from "@/lib/orchestration/validateStructuredOutput";
import { createChatCompletion, resolveModelName } from "@/lib/openai/client";
import { calculateCost } from "@/lib/costCalculator";
import type { RoutedModelDecision } from "@/lib/modelRoutingTypes";
import { defaultPricingForProvider, getPricingForRegistryModelId } from "@/lib/pricing";
import { getModelRegistry, resolveModelById, type ModelProvider } from "@/lib/models";
import type { NormalizedUsage } from "@/lib/usageNormalizer";
import { completionResultToNormalized, estimateUsageFallback } from "@/lib/usageNormalizer";
import { sanitizeUserInput } from "@/lib/security";
import { captureError } from "@/lib/sentry";
import { AgentConfig, Message, Prisma } from "@prisma/client";

type AgentContract = {
  id: string;
  systemPrompt: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  temperature: number;
  requiresStructuredValidation: boolean;
  enforceMarkdownSections: boolean;
};

export async function prepareOrchestrator(params: {
  userId: string;
  sessionId: string;
  agentId: string;
  text: string;
  imageUrls?: string[];
  resolvedImageUrls?: string[];
  editedFromId?: string;
  regenOfId?: string;
  turnId?: string;
  skipUserInsert?: boolean;
}) {
  const {
    userId,
    sessionId,
    agentId,
    imageUrls,
    resolvedImageUrls,
    editedFromId,
    regenOfId,
    turnId,
    skipUserInsert,
  } = params;
  const text = sanitizeUserInput(params.text);

  const [session, agent] = await Promise.all([
    db.chatSession.findFirst({ where: { id: sessionId, userId } }),
    db.agentConfig.findFirst({ where: { id: agentId, isEnabled: true } }),
  ]);

  if (!session) throw new Error("Session not found.");
  if (!agent) throw new Error("Agent not found.");

  if (!skipUserInsert) {
    await db.message.create({
      data: {
        sessionId,
        userId,
        role: "user",
        content: text,
        imageUrls: imageUrls ?? [],
        agentConfigId: agent.id,
        editedFromId,
        regenOfId,
        turnId,
      },
    });
  }

  const history = await db.message.findMany({
    where: { sessionId, userId },
    orderBy: { createdAt: "asc" },
  });

  let contextSummary = session.summary || "";
  
  if (history.length > 15 && !session.summary) {
    // Non-blocking summary generation
    const triggerSummarizationAsync = async () => {
      try {
        const summary = await summarizeConversation(history);
        if (summary && summary.trim().length > 0) {
          await db.chatSession.update({
            where: { id: sessionId },
            data: { summary }
          });
        }
      } catch (error) {
        console.error("Background summarization failed", error);
      }
    };
    triggerSummarizationAsync();
  }

  const messages = buildMessages({
    agent,
    history,
    userInput: text,
    imageUrls: resolvedImageUrls ?? imageUrls,
    contextSummary,
  });

  return { agent, messages, sessionId, userId, text };
}

async function summarizeConversation(history: Message[]): Promise<string> {
  if (history.length === 0) {
    return "No previous messages in this conversation.";
  }

  const transcript = history
    .slice(-20)
    .map((message) => {
      const compact = message.content.replace(/\s+/g, " ").trim();
      return `[${message.role}] ${compact}`;
    })
    .join("\n");

  try {
    const { content: summary } = await createChatCompletion(
      [
        {
          role: "system",
          content:
            "Summarize the conversation in 4-6 concise bullets covering intent, constraints, and outputs. Keep it factual.",
        },
        {
          role: "user",
          content: `Conversation transcript:\n${transcript}`,
        },
      ],
      { temperature: 0, maxTokens: 220 }
    );

    const cleaned = summary.replace(/\s+\n/g, "\n").trim();
    if (cleaned.length > 0) return cleaned.slice(0, 1200);
  } catch {
    // Fallback to deterministic summary if model summarization fails.
  }

  const fallback = history
    .slice(-6)
    .map((message, index) => {
      const concise = message.content.replace(/\s+/g, " ").trim().slice(0, 160);
      return `${index + 1}. [${message.role}] ${concise}`;
    })
    .join("\n");
  return fallback;
}

export function charEstimateFromMessages(messages: ChatMessage[] | undefined, userText: string): number {
  let n = userText.length;
  if (!messages) return n;
  for (const m of messages) {
    if (typeof m.content === "string") n += m.content.length;
    else for (const b of m.content) n += b.type === "text" ? b.text.length : 200;
  }
  return n;
}

export async function finalizeAssistantMessage(params: {
  userId: string;
  sessionId: string;
  agentId: string;
  text: string;
  responseText: string;
  messages?: ChatMessage[];
  modelVersion?: string;
  /** Registry id for pricing/usage (preferred over resolving from legacy display name). */
  registryModelId?: string;
  /** Primary completion usage from stream or non-stream caller. */
  usage?: NormalizedUsage | null;
  routerDecision?: RoutedModelDecision;
  assistantMessageId?: string;
  providerHint?: ModelProvider | null;
}) {
  const {
    userId,
    sessionId,
    agentId,
    text,
    responseText,
    messages,
    modelVersion,
    registryModelId,
    usage,
    routerDecision,
    assistantMessageId,
    providerHint,
  } = params;
  const agent = await db.agentConfig.findFirst({ where: { id: agentId } });
  if (!agent) throw new Error("Agent not found.");
  const contract = buildAgentContract(agent);
  const outputMode = getOutputMode(agent);

  let finalOutput = responseText;

  // Strict output validation loop:
  // 1) validate initial output
  // 2) if invalid, retry once with corrective system instruction
  // 3) if still invalid, return safe fallback structure
  if (contract.requiresStructuredValidation) {
    const initialCheck = validateStructuredOutput(
      finalOutput,
      outputMode,
      contract.outputSchema
    );

    if (!initialCheck.ok) {
      let retryOutput: string | null = null;
      if (messages && messages.length > 0) {
        try {
          const { content: retry } = await createChatCompletion(
            [
              ...messages,
              {
                role: "system",
                content:
                  "Your previous output was invalid. Fix it to match the required schema EXACTLY. Do not add extra text.",
              },
            ],
            {
              temperature: Math.min(agent.temperature, 0.2),
              maxTokens: agent.maxTokens,
              modelVersion,
            }
          );
          retryOutput = retry;
        } catch (e) {
          captureError(e, { route: "finalizeAssistantMessage/structured-retry" });
          retryOutput = null;
        }
      }

      if (retryOutput) {
        const retryCheck = validateStructuredOutput(
          retryOutput,
          outputMode,
          contract.outputSchema
        );
        if (retryCheck.ok) {
          finalOutput = retryOutput;
        } else {
          finalOutput = JSON.stringify({ error: "Invalid AI response format" });
        }
      } else {
        finalOutput = JSON.stringify({ error: "Invalid AI response format" });
      }
    }
  } else if (contract.enforceMarkdownSections && !requiresJsonOutput(agent)) {
    finalOutput = ensureMarkdownSections(finalOutput);
  }

  const assistantMessage = assistantMessageId
    ? await db.message.update({
        where: { id: assistantMessageId },
        data: {
          content: finalOutput,
          agentConfigId: agent.id,
          model: registryModelId ?? modelVersion ?? null,
          provider: providerHint ?? null,
          deliveryStatus: "COMPLETED",
          completedAt: new Date(),
          failedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      })
    : await db.message.create({
        data: {
          sessionId,
          userId,
          role: "assistant",
          content: finalOutput,
          agentConfigId: agent.id,
          model: registryModelId ?? modelVersion ?? null,
          provider: providerHint ?? null,
          deliveryStatus: "COMPLETED",
          completedAt: new Date(),
        },
      });

  const regId = registryModelId ?? modelVersion ?? "openai-gpt-4o-mini";
  const resolved = resolveModelById(regId);
  const providerForUsage = providerHint ?? resolved?.provider ?? "openai";

  const normalized: NormalizedUsage =
    usage ??
    estimateUsageFallback({
      registryModelId: regId,
      provider: providerForUsage,
      promptCharLength: charEstimateFromMessages(messages, text),
      completionCharLength: finalOutput.length,
    });

  const pricing = getPricingForRegistryModelId(regId) ?? defaultPricingForProvider(providerForUsage);
  const cost = calculateCost(normalized, pricing);

  try {
    await db.tokenUsage.create({
      data: {
        userId,
        sessionId,
        messageId: assistantMessage.id,
        model: resolveModelName(modelVersion),
        registryModelId: regId,
        provider: providerForUsage,
        promptTokens: normalized.promptTokens ?? 0,
        completionTokens: normalized.completionTokens ?? 0,
        totalTokens: normalized.totalTokens ?? 0,
        cachedInputTokens: normalized.cachedInputTokens ?? null,
        exactUsage: normalized.exact,
        estimationMethod: normalized.estimationMethod ?? null,
        pricingSnapshot: pricing as unknown as Prisma.InputJsonValue,
        inputCost: cost.inputCost,
        outputCost: cost.outputCost,
        totalCost: cost.totalCost,
        currency: "USD",
        routerMode: routerDecision?.mode ?? null,
        routerReasonCodes:
          routerDecision?.reasonCodes && routerDecision.reasonCodes.length > 0
            ? (routerDecision.reasonCodes as unknown as Prisma.InputJsonValue)
            : undefined,
      },
    });
  } catch (e) {
    captureError(e, { route: "finalizeAssistantMessage/tokenUsage", userId });
  }

  try {
    await autoTitleSession({
      userId,
      sessionId,
      seedText: text,
    });
  } catch (e) {
    captureError(e, { route: "finalizeAssistantMessage/autoTitle", userId });
  }

  return assistantMessage;
}

async function autoTitleSession(params: {
  userId: string;
  sessionId: string;
  seedText: string;
}) {
  const { userId, sessionId, seedText } = params;
  const session = await db.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, title: true },
  });
  if (!session || session.title !== "New Chat") return;

  const userMessageCount = await db.message.count({
    where: { sessionId, userId, role: "user" },
  });
  if (userMessageCount !== 1) return;

  const nextTitle = buildTitleFromPrompt(seedText);
  if (!nextTitle) return;

  await db.chatSession.update({
    where: { id: sessionId },
    data: { title: nextTitle },
  });
}

function buildTitleFromPrompt(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return "New Chat";
  const cleaned = normalized.replace(/^["'`#\-\s]+|["'`#\-\s]+$/g, "");
  if (cleaned.length <= 60) return cleaned;
  return `${cleaned.slice(0, 57).trimEnd()}...`;
}

export async function runOrchestrator(params: {
  userId: string;
  sessionId: string;
  agentId: string;
  text: string;
  imageUrls?: string[];
  editedFromId?: string;
  regenOfId?: string;
}) {
  const { userId, sessionId, agentId, text } = params;
  const prep = await prepareOrchestrator(params);

  const { content: responseText, rawUsage } = await createChatCompletion(prep.messages, {
    temperature: prep.agent.temperature,
    maxTokens: prep.agent.maxTokens,
  });

  const promptChars = charEstimateFromMessages(prep.messages, text);
  const fallbackModel = getModelRegistry().find((m) => m.enabled) ?? getModelRegistry()[0];
  const regId = fallbackModel?.id ?? "openai-gpt-4o-mini";
  const provider = fallbackModel?.provider ?? "openai";
  const usageNorm = completionResultToNormalized(
    rawUsage,
    regId,
    provider,
    promptChars,
    responseText.length
  );

  return finalizeAssistantMessage({
    userId,
    sessionId,
    agentId,
    text,
    responseText,
    messages: prep.messages,
    modelVersion: regId,
    registryModelId: regId,
    usage: usageNorm,
  });
}

function buildAgentContract(agent: AgentConfig): AgentContract {
  const hasOutputSchema = Boolean(agent.outputSchema);
  return {
    id: agent.id,
    systemPrompt: agent.systemPrompt,
    inputSchema: agent.inputSchema ?? undefined,
    outputSchema: agent.outputSchema ?? undefined,
    temperature: agent.temperature,
    requiresStructuredValidation: hasOutputSchema,
    enforceMarkdownSections: !hasOutputSchema,
  };
}

function ensureMarkdownSections(output: string): string {
  const trimmed = output.trim();
  const hasResult = /^##\s*Result\b/im.test(trimmed);
  const hasDetails = /^##\s*Details\b/im.test(trimmed);
  if (hasResult && hasDetails) return trimmed;
  return `## Result\n${trimmed || "No result provided."}\n\n## Details\n- Generated in markdown structured mode.`;
}
