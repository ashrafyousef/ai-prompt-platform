import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { finalizeAssistantMessage, prepareOrchestrator } from "@/lib/orchestration/chatOrchestrator";
import { checkRateLimit } from "@/lib/rateLimit";
import { streamChatCompletion } from "@/lib/openai/client";
import { assertUserWithinSoftTokenLimit } from "@/lib/usage";
import { captureError } from "@/lib/sentry";
import { logJson } from "@/lib/logger";

const sendSchema = z.object({
  sessionId: z.string().min(1),
  agentId: z.string().min(1),
  text: z.string().min(1),
  imageUrls: z.array(z.string().url()).optional(),
  editedFromId: z.string().optional(),
  regenOfId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const start = Date.now();
  let userIdForLogs = "unknown";
  try {
    const userId = await requireUserId();
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
    await assertUserWithinSoftTokenLimit({
      userId,
      additionalEstimatedTokens: Math.ceil(payload.text.length / 4) + 1200,
    });
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
    captureError(error, { route: "/api/chat/send", userId: userIdForLogs });
    logJson("error", {
      route: "/api/chat/send",
      userId: userIdForLogs,
      tokensUsed: 0,
      latencyMs: Date.now() - start,
      status: "error",
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message." },
      { status: 400 }
    );
  }
}
