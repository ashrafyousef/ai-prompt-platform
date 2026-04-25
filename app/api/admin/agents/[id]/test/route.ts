import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminUserId } from "@/lib/adminAuth";
import { createChatCompletion } from "@/lib/openai/client";
import { buildEffectiveAgentConfig } from "@/lib/agentEffectiveConfig";
import type { AgentKnowledgeItem, AgentOutputConfig } from "@/lib/agentConfig";

const testSchema = z.object({
  prompt: z.string().min(1),
});

function buildKnowledgeBlock(items: AgentKnowledgeItem[]): string {
  const active = items.filter((i) => i.isActive);
  if (active.length === 0) return "";

  const lines = active.map((item) => {
    const body = item.content?.trim()
      ? item.content.trim().slice(0, 2000)
      : `[Uploaded file: ${item.fileRef?.fileName ?? "unknown"}]`;
    return `### ${item.title}\nType: ${item.sourceType}\n${body}`;
  });

  return `\n\n---\nReference Knowledge:\n${lines.join("\n\n")}`;
}

function buildOutputInstructions(config: AgentOutputConfig): string {
  const parts: string[] = [];

  if (config.format === "json") {
    parts.push("Respond with valid JSON only.");
  } else if (config.format === "template") {
    if (config.template?.trim()) {
      parts.push(`Use this response template:\n${config.template.trim()}`);
    }
  }

  if (config.requiredSections.length > 0) {
    parts.push(`Include these sections: ${config.requiredSections.join(", ")}.`);
  }

  if (config.responseDepth === "brief") {
    parts.push("Keep the response concise and brief.");
  } else if (config.responseDepth === "detailed") {
    parts.push("Provide a thorough, detailed response.");
  }

  if (config.citationsPolicy === "required") {
    parts.push("You must cite your sources when referencing knowledge.");
  } else if (config.citationsPolicy === "optional") {
    parts.push("Cite sources when helpful.");
  }

  if (config.fallbackBehavior?.trim()) {
    parts.push(`If you cannot fully answer: ${config.fallbackBehavior.trim()}`);
  }

  return parts.length > 0 ? `\n\n---\nOutput Instructions:\n${parts.join("\n")}` : "";
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminUserId();
    const { prompt } = testSchema.parse(await req.json());

    const agent = await db.agentConfig.findUnique({ where: { id: params.id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    const effective = buildEffectiveAgentConfig(agent);
    const activeKnowledge = effective.knowledgeItems.filter((i) => i.isActive);

    const enrichedSystemPrompt = [
      agent.systemPrompt,
      buildKnowledgeBlock(effective.knowledgeItems),
      buildOutputInstructions(effective.outputConfig),
    ].join("");

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system", content: enrichedSystemPrompt },
      { role: "user", content: prompt },
    ];

    const startMs = Date.now();
    const { content: response } = await createChatCompletion(messages, {
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    });
    const durationMs = Date.now() - startMs;

    let schemaValid: boolean | null = null;
    if (effective.outputConfig.format === "json") {
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
        outputFormat: effective.outputConfig.format,
        schemaValid,
        configSummary: {
          knowledgeCount: activeKnowledge.length,
          knowledgeTotal: effective.knowledgeItems.length,
          outputFormat: effective.outputConfig.format,
          responseDepth: effective.outputConfig.responseDepth,
          citationsPolicy: effective.outputConfig.citationsPolicy,
          requiredSections: effective.outputConfig.requiredSections,
          hasTemplate: Boolean(effective.outputConfig.template?.trim()),
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Test failed.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
