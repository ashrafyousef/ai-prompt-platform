import { AgentConfig, Message } from "@prisma/client";

type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

export function trimHistory(messages: Message[], maxMessages = 16): Message[] {
  if (messages.length <= maxMessages) return messages;
  return messages.slice(messages.length - maxMessages);
}

export function buildMessages(params: {
  agent: AgentConfig;
  history: Message[];
  userInput: string;
  imageUrls?: string[];
}): ChatMessage[] {
  const { agent, history, userInput, imageUrls } = params;
  const trimmed = trimHistory(history);

  const systemParts = [agent.systemPrompt];
  if (agent.outputFormat === "json" && agent.outputSchema) {
    systemParts.push(
      `Return valid JSON only. Required schema: ${JSON.stringify(agent.outputSchema)}`
    );
  } else if (agent.outputFormat === "template") {
    systemParts.push("Use clear titled sections and keep output structured.");
  } else {
    systemParts.push("Use markdown sections with concise headings.");
  }

  const userContent =
    imageUrls && imageUrls.length > 0
      ? ([
          { type: "text", text: userInput },
          ...imageUrls.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ] as ChatMessage["content"])
      : userInput;

  return [
    { role: "system", content: systemParts.join("\n\n") },
    ...trimmed.map((m) => {
      const maybeImageUrls = Array.isArray(m.imageUrls) ? m.imageUrls : [];
      if (m.role === "user" && maybeImageUrls.length > 0) {
        return {
          role: m.role as ChatRole,
          content: [
            { type: "text" as const, text: m.content },
            ...maybeImageUrls
              .filter((value): value is string => typeof value === "string")
              .map((url) => ({
                type: "image_url" as const,
                image_url: { url },
              })),
          ],
        };
      }
      return { role: m.role as ChatRole, content: m.content };
    }),
    { role: "user", content: userContent },
  ];
}
