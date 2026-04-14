import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userTeamId = session.user.teamId ?? null;

    const where: Prisma.AgentConfigWhereInput = {
      status: "PUBLISHED",
      isEnabled: true,
      OR: [
        { scope: "GLOBAL" },
        ...(userTeamId ? [{ scope: "TEAM" as const, teamId: userTeamId }] : []),
      ],
    };

    const rows = await db.agentConfig.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        inputSchema: true,
        scope: true,
      },
    });

    const agents = rows.map((a) => {
      const schema = a.inputSchema as Record<string, unknown> | null;
      const starterPrompts = (schema?.starterPrompts ?? []) as string[];
      const meta = schema as { icon?: string; category?: string } | null;
      return {
        id: a.id,
        name: a.name,
        slug: a.slug,
        description: a.description,
        icon: meta?.icon ?? null,
        category: meta?.category ?? null,
        starterPrompts,
      };
    });

    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load agents." },
      { status: 500 }
    );
  }
}
