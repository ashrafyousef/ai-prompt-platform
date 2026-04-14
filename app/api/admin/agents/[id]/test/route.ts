import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminUserId } from "@/lib/adminAuth";
import { createChatCompletion } from "@/lib/openai/client";

const testSchema = z.object({
  prompt: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminUserId();
    const { prompt } = testSchema.parse(await req.json());

    const agent = await db.agentConfig.findUnique({ where: { id: params.id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system", content: agent.systemPrompt },
      { role: "user", content: prompt },
    ];

    const startMs = Date.now();
    const response = await createChatCompletion(messages, {
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    });
    const durationMs = Date.now() - startMs;

    let schemaValid: boolean | null = null;
    if (agent.outputFormat === "json" && agent.outputSchema) {
      try {
        JSON.parse(response);
        schemaValid = true;
      } catch {
        schemaValid = false;
      }
    }

    return NextResponse.json({
      result: {
        response,
        durationMs,
        model: "auto",
        outputFormat: agent.outputFormat,
        schemaValid,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Test failed.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
