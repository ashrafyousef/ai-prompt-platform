import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

/** Lowercase URL-safe slug for workspace-scoped entities (clients, projects). */
export const WORKSPACE_ENTITY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DUPLICATE_WORKSPACE_CLIENT_SLUG_MESSAGE =
  "A client with this slug already exists in the workspace.";

export const DUPLICATE_WORKSPACE_PROJECT_SLUG_MESSAGE =
  "A project with this slug already exists in the workspace.";

export function slugifyWorkspaceEntityName(name: string, maxLength = 48): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return base.length > 0 ? base : "item";
}

export function parseIncludeArchivedParam(searchParams: URLSearchParams): boolean {
  return searchParams.get("includeArchived") === "true";
}

/** Prisma P2002 on workspace-scoped entity slug uniqueness (race-safe duplicate handling). */
export function isWorkspaceSlugUniqueViolation(error: unknown): boolean {
  if (!(error instanceof PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("workspaceId") && target.includes("slug");
  }
  if (typeof target === "string") {
    return (
      target === "Client_workspaceId_slug_key" ||
      target === "Project_workspaceId_slug_key" ||
      target.includes("workspaceId_slug")
    );
  }
  return false;
}
