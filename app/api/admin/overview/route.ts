import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";

export async function GET() {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const workspaceId = auth.workspaceId;

    const [
      total,
      published,
      draft,
      archived,
      workspaceWide,
      teamScoped,
      teams,
      members,
      activeMembers,
      knowledgeTotal,
      knowledgeActive,
      recentRaw,
      draftAgentsRaw,
      archivedAgentsRaw,
    ] = await Promise.all([
      db.agentConfig.count({ where: { workspaceId } }),
      db.agentConfig.count({ where: { workspaceId, status: "PUBLISHED" } }),
      db.agentConfig.count({ where: { workspaceId, status: "DRAFT" } }),
      db.agentConfig.count({ where: { workspaceId, status: "ARCHIVED" } }),
      db.agentConfig.count({ where: { workspaceId, scope: "GLOBAL" } }),
      db.agentConfig.count({ where: { workspaceId, scope: "TEAM" } }),
      db.team.findMany({
        where: { workspaceId },
        orderBy: { name: "asc" },
        include: { _count: { select: { agents: true, workspaceMembers: true } } },
      }),
      db.workspaceMember.count({ where: { workspaceId } }),
      db.workspaceMember.count({ where: { workspaceId, isActive: true } }),
      db.knowledgeItem.count({ where: { workspaceId } }),
      db.knowledgeItem.count({ where: { workspaceId, isActive: true } }),
      db.agentConfig.findMany({
        take: 8,
        where: { workspaceId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          updatedAt: true,
          team: { select: { name: true } },
        },
      }),
      db.agentConfig.findMany({
        where: { workspaceId, status: "DRAFT" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          updatedAt: true,
          team: { select: { name: true } },
        },
      }),
      db.agentConfig.findMany({
        where: { workspaceId, status: "ARCHIVED" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
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

    const archivedTeams = teams.filter((team) => team.isArchived).length;
    const unassigned = await db.agentConfig.count({ where: { workspaceId, teamId: null } });
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
    const draftAgents = draftAgentsRaw.map((a) => ({
      id: a.id,
      name: a.name,
      teamName: a.team?.name ?? null,
      updatedAt: a.updatedAt.toISOString(),
    }));
    const archivedAgents = archivedAgentsRaw.map((a) => ({
      id: a.id,
      name: a.name,
      teamName: a.team?.name ?? null,
      updatedAt: a.updatedAt.toISOString(),
    }));
    const teamsWithoutAgents = teams
      .filter((team) => team._count.agents === 0)
      .map((team) => ({
        id: team.id,
        name: team.name,
        isArchived: team.isArchived,
      }));

    const inactiveKnowledgeItems = await db.knowledgeItem.findMany({
      where: {
        workspaceId,
        isActive: false,
      },
      select: {
        agentLinks: {
          select: {
            agent: {
              select: {
                id: true,
                name: true,
                team: { select: { name: true } },
              },
            },
          },
        },
      },
      take: 200,
    });
    const inactiveKnowledgeMap = new Map<
      string,
      { agentId: string; agentName: string; teamName: string | null; inactiveCount: number }
    >();
    for (const item of inactiveKnowledgeItems) {
      for (const link of item.agentLinks) {
        const key = link.agent.id;
        const prev = inactiveKnowledgeMap.get(key);
        if (prev) {
          prev.inactiveCount += 1;
        } else {
          inactiveKnowledgeMap.set(key, {
            agentId: link.agent.id,
            agentName: link.agent.name,
            teamName: link.agent.team?.name ?? null,
            inactiveCount: 1,
          });
        }
      }
    }
    const inactiveKnowledgeByAgent = Array.from(inactiveKnowledgeMap.values())
      .sort((a, b) => b.inactiveCount - a.inactiveCount)
      .slice(0, 5);

    const knowledgeInactive = Math.max(knowledgeTotal - knowledgeActive, 0);
    const recommendations: Array<{ id: string; label: string; href: string }> = [];
    if (teamScoped === 0 && teams.length > 0) {
      recommendations.push({
        id: "team-scope-usage",
        label: "No Team-scoped agents yet. Review team ownership and agent visibility boundaries.",
        href: "/admin/agents",
      });
    }
    if (teams.length === 0) {
      recommendations.push({
        id: "setup-teams",
        label: "No teams configured yet. Create teams before scaling Team-scoped agents.",
        href: "/admin/teams",
      });
    }
    if (knowledgeTotal > 0 && knowledgeInactive >= knowledgeActive) {
      recommendations.push({
        id: "knowledge-activation",
        label: "Inactive knowledge dominates. Review activation status in Knowledge Admin.",
        href: "/admin/knowledge",
      });
    }
    if (draft > published) {
      recommendations.push({
        id: "draft-backlog",
        label: "Drafts outnumber published agents. Review publishing readiness.",
        href: "/admin/agents",
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        id: "steady-state",
        label: "Workspace looks balanced. Spot-check agents and knowledge freshness.",
        href: "/admin/agents",
      });
    }

    return NextResponse.json({
      counts: {
        total,
        published,
        draft,
        archived,
        workspaceWide,
        teamScoped,
        members,
        activeMembers,
        teams: teams.length,
        archivedTeams,
        knowledgeTotal,
        knowledgeActive,
        knowledgeInactive,
      },
      recommendations,
      attention: {
        draftAgents,
        archivedAgents,
        teamsWithoutAgents,
        inactiveKnowledgeByAgent,
      },
      byTeam,
      recent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load overview.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
