import { db } from "@/lib/db";
import { buildMessages } from "@/lib/orchestration/buildMessages";
import { validateStructuredOutput } from "@/lib/orchestration/validateStructuredOutput";
import { createChatCompletion } from "@/lib/openai/client";

export async function prepareOrchestrator(params: {
  userId: string;
  sessionId: string;
  agentId: string;
  text: string;
  imageUrls?: string[];
  editedFromId?: string;
  regenOfId?: string;
}) {
  const { userId, sessionId, agentId, text, imageUrls, editedFromId, regenOfId } = params;

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

  const messages = buildMessages({
    agent,
    history,
    userInput: text,
    imageUrls,
  });

  return { agent, messages, sessionId, userId, text };
}

export async function finalizeAssistantMessage(params: {
  userId: string;
  sessionId: string;
  agentId: string;
  text: string;
  responseText: string;
}) {
  const { userId, sessionId, agentId, text, responseText } = params;
  const agent = await db.agentConfig.findFirst({ where: { id: agentId } });
  if (!agent) throw new Error("Agent not found.");

  let finalOutput = responseText;
  const outputCheck = validateStructuredOutput(
    finalOutput,
    agent.outputFormat,
    agent.outputSchema
  );
  if (!outputCheck.ok && outputCheck.repairedOutput) {
    finalOutput = outputCheck.repairedOutput;
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
      model: "gpt-4o-mini",
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
  });
}
