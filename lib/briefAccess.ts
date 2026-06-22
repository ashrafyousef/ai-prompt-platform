import type { BriefStatus, Prisma, ProjectStatus } from "@prisma/client";
import type { WorkspaceMemberManagerContext } from "@/lib/adminAuth";
import {
  buildAdminProjectListWhere,
  canViewProjectForActor,
  toProjectActorContextFromManager,
  type ProjectAccessTarget,
  type ProjectActorContext,
} from "@/lib/projectAccess";

export type BriefAccessProject = ProjectAccessTarget & {
  id: string;
};

/** Brief visibility inherits parent project visibility rules. */
export function canViewBriefForActor(
  actor: ProjectActorContext,
  project: BriefAccessProject
): boolean {
  return canViewProjectForActor(actor, project);
}

export function toBriefActorContextFromManager(
  auth: WorkspaceMemberManagerContext
): ProjectActorContext {
  return toProjectActorContextFromManager(auth);
}

/** Admin brief list filter: visible projects + optional archived brief exclusion. */
export function buildAdminBriefListWhere(
  actor: ProjectActorContext,
  options: { includeArchived?: boolean; projectId?: string | null }
): Prisma.BriefWhereInput {
  const projectWhere = buildAdminProjectListWhere(actor, { includeArchived: true });

  if (options.projectId) {
    projectWhere.id = options.projectId;
  }

  const where: Prisma.BriefWhereInput = {
    project: projectWhere,
  };

  if (!options.includeArchived) {
    where.status = { not: "ARCHIVED" };
  }

  return where;
}

/** Whether brief intake responses may be edited in admin UI/API. */
export function canEditBriefResponses(
  briefStatus: BriefStatus,
  projectStatus: ProjectStatus
): boolean {
  if (projectStatus === "ARCHIVED") return false;
  if (briefStatus === "ARCHIVED") return false;
  return briefStatus === "DRAFT";
}

/** Whether raw brief analysis may be run in admin UI/API. */
export function canAnalyzeBrief(
  briefStatus: BriefStatus,
  projectStatus: ProjectStatus
): boolean {
  return canEditBriefResponses(briefStatus, projectStatus);
}
