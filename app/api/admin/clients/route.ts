import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  formatAdminRouteError,
  requireWorkspaceMemberManagerContext,
} from "@/lib/adminAuth";
import {
  parseIncludeArchivedParam,
  slugifyWorkspaceEntityName,
  WORKSPACE_ENTITY_SLUG_PATTERN,
  isWorkspaceSlugUniqueViolation,
  DUPLICATE_WORKSPACE_CLIENT_SLUG_MESSAGE,
} from "@/lib/adminSlug";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(WORKSPACE_ENTITY_SLUG_PATTERN, "Slug must be lowercase letters, numbers, and hyphens.")
    .max(64)
    .optional(),
});

function serializeClient(
  client: {
    id: string;
    name: string;
    slug: string;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
    _count: { projects: number };
  }
) {
  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    isArchived: client.isArchived,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    projectCount: client._count.projects,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const includeArchived = parseIncludeArchivedParam(req.nextUrl.searchParams);

    const clients = await db.client.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { projects: true } },
      },
    });

    return NextResponse.json({
      viewer: {
        workspaceRole: auth.workspaceRole,
        platformRole: auth.platformRole,
      },
      clients: clients.map(serializeClient),
    });
  } catch (error) {
    const { status, body } = formatAdminRouteError(error, "Failed to load clients.");
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const body = createSchema.parse(await req.json());
    const slug = body.slug ?? slugifyWorkspaceEntityName(body.name);

    const existing = await db.client.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId: auth.workspaceId,
          slug,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: DUPLICATE_WORKSPACE_CLIENT_SLUG_MESSAGE },
        { status: 409 }
      );
    }

    const created = await db.client.create({
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
        createdAt: true,
        updatedAt: true,
        _count: { select: { projects: true } },
      },
    });

    return NextResponse.json({ client: serializeClient(created) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid client input." }, { status: 400 });
    }
    if (isWorkspaceSlugUniqueViolation(error)) {
      return NextResponse.json({ error: DUPLICATE_WORKSPACE_CLIENT_SLUG_MESSAGE }, { status: 409 });
    }
    const { status, body } = formatAdminRouteError(error, "Failed to create client.");
    return NextResponse.json(body, { status: status === 500 ? 400 : status });
  }
}
