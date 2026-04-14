import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminUserId } from "@/lib/adminAuth";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdminUserId();
    const orig = await db.agentConfig.findUnique({ where: { id: params.id } });
    if (!orig) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    const base = `${orig.slug}-copy`;
    let slug = base;
    let n = 2;
    while (await db.agentConfig.findUnique({ where: { slug } })) {
      slug = `${base}-${n}`;
      n += 1;
    }

    const created = await db.agentConfig.create({
      data: {
        slug,
        name: `${orig.name} (copy)`,
        description: orig.description,
        systemPrompt: orig.systemPrompt,
        inputSchema: orig.inputSchema ?? undefined,
        outputFormat: orig.outputFormat,
        outputSchema: orig.outputSchema ?? undefined,
        temperature: orig.temperature,
        maxTokens: orig.maxTokens,
        isEnabled: false,
        status: "DRAFT",
        scope: orig.scope,
        teamId: orig.teamId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      agent: { ...created, updatedAt: created.updatedAt.toISOString() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Duplicate failed.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
