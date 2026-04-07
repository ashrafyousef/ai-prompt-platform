import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { finalizeAssistantMessage, prepareOrchestrator } from "@/lib/orchestration/chatOrchestrator";
import { checkRateLimit } from "@/lib/rateLimit";
import { streamChatCompletion } from "@/lib/openai/client";

const sendSchema = z.object({
  sessionId: z.string().min(1),
  agentId: z.string().min(1),
  text: z.string().min(1),
  imageUrls: z.array(z.string().url()).optional(),
  editedFromId: z.string().optional(),
  regenOfId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!checkRateLimit(userId)) {
      return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
    }

    const payload = sendSchema.parse(await req.json());
    const encoder = new TextEncoder();
    const prepared = await prepareOrchestrator({ userId, ...payload });

    const stream = new ReadableStream({
      async start(controller) {
        let output = "";
        try {
          for await (const delta of streamChatCompletion(prepared.messages, {
            temperature: prepared.agent.temperature,
            maxTokens: prepared.agent.maxTokens,
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
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Streaming failed during response generation.";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message." },
      { status: 400 }
    );
  }
}
