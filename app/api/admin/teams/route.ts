import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

function slugifyTeamName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base.length > 0 ? base : "team";
}

export async function GET() {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const scopedToOwnTeam =
      auth.workspaceRole === "ADMIN" && auth.platformRole !== "ADMIN";

    const teams = await db.team.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...(scopedToOwnTeam
          ? {
              id: auth.teamId ?? "__no_team__",
            }
          : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        isArchived: true,
        _count: {
          select: {
            workspaceMembers: true,
          },
        },
      },
    });
    return NextResponse.json({
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        isArchived: t.isArchived,
        memberCount: t._count.workspaceMembers,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load teams.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const body = createSchema.parse(await req.json());
    const existing = await db.team.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        name: {
          equals: body.name,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "A team with this name already exists." }, { status: 409 });
    }

    const slugBase = slugifyTeamName(body.name);
    const slug = `${slugBase}-${Date.now().toString(36)}`;
    const created = await db.team.create({
      data: {
        workspaceId: auth.workspaceId,
        name: body.name,
        slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isArchived: true,
      },
    });

    return NextResponse.json({ team: created });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Invalid team input."
        : error instanceof Error
          ? error.message
          : "Failed to create team.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
