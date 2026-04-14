import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminUserId } from "@/lib/adminAuth";

export async function GET() {
  try {
    await requireAdminUserId();

    const [total, published, draft, archived, teams, recentRaw] = await Promise.all([
      db.agentConfig.count(),
      db.agentConfig.count({ where: { status: "PUBLISHED" } }),
      db.agentConfig.count({ where: { status: "DRAFT" } }),
      db.agentConfig.count({ where: { status: "ARCHIVED" } }),
      db.team.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { agents: true } } },
      }),
      db.agentConfig.findMany({
        take: 8,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          updatedAt: true,
          team: { select: { name: true } },
        },
      }),
    ]);

    const byTeam: Array<{ teamId: string | null; teamName: string; count: number }> = teams.map((t) => ({
      teamId: t.id,
      teamName: t.name,
      count: t._count.agents,
    }));

    const unassigned = await db.agentConfig.count({ where: { teamId: null } });
    if (unassigned > 0) {
      byTeam.push({
        teamId: null,
        teamName: "Unassigned",
        count: unassigned,
      });
    }

    const recent = recentRaw.map((a) => ({
      id: a.id,
      name: a.name,
      teamName: a.team?.name ?? null,
      status: a.status,
      updatedAt: a.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      counts: { total, published, draft, archived },
      byTeam,
      recent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load overview.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
