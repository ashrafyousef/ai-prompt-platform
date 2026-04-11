import { db } from "@/lib/db";
import { buildMessages, ChatMessage } from "@/lib/orchestration/buildMessages";
import { getOutputMode, requiresJsonOutput } from "@/lib/orchestration/agentContract";
import { validateStructuredOutput } from "@/lib/orchestration/validateStructuredOutput";
import { createChatCompletion, resolveModelName } from "@/lib/openai/client";
import { sanitizeUserInput } from "@/lib/security";
import { AgentConfig, Message } from "@prisma/client";

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
}) {
  const { userId, sessionId, agentId, imageUrls, resolvedImageUrls, editedFromId, regenOfId } = params;
  const text = sanitizeUserInput(params.text);

  const [session, agent] = await Promise.all([
    db.chatSession.findFirst({ where: { id: sessionId, userId } }),
    db.agentConfig.findFirst({ where: { id: agentId, isEnabled: true } }),
  ]);

  if (!session) throw new Error("Session not found.");
  if (!agent) throw new Error("Agent not found.");

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
    },
  });

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
    const summary = await createChatCompletion(
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

export async function finalizeAssistantMessage(params: {
  userId: string;
  sessionId: string;
  agentId: string;
  text: string;
  responseText: string;
  messages?: ChatMessage[];
  modelVersion?: string;
}) {
  const { userId, sessionId, agentId, text, responseText, messages, modelVersion } = params;
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
        retryOutput = await createChatCompletion(
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
          }
        );
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

  const assistantMessage = await db.message.create({
    data: {
      sessionId,
      userId,
      role: "assistant",
      content: finalOutput,
      agentConfigId: agent.id,
    },
  });

  await db.tokenUsage.create({
    data: {
      userId,
      sessionId,
      model: resolveModelName(modelVersion),
      promptTokens: Math.ceil(text.length / 4),
      completionTokens: Math.ceil(finalOutput.length / 4),
      totalTokens: Math.ceil((text.length + finalOutput.length) / 4),
    },
  });

  await autoTitleSession({
    userId,
    sessionId,
    seedText: text,
  });

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

  const responseText = await createChatCompletion(prep.messages, {
    temperature: prep.agent.temperature,
    maxTokens: prep.agent.maxTokens,
  });

  return finalizeAssistantMessage({
    userId,
    sessionId,
    agentId,
    text,
    responseText,
    messages: prep.messages,
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
