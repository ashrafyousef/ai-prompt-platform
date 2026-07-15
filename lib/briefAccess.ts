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
  return canViewProjectForActor(actor, project, { includeArchivedProjects: true });
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

/** Whether a brief may be reopened to DRAFT from SUBMITTED or IN_REVIEW. */
export function canReopenBrief(
  briefStatus: BriefStatus,
  projectStatus: ProjectStatus
): boolean {
  if (projectStatus === "ARCHIVED") return false;
  if (briefStatus === "ARCHIVED") return false;
  if (briefStatus === "APPROVED") return false;
  if (briefStatus === "DRAFT") return false;
  return briefStatus === "SUBMITTED" || briefStatus === "IN_REVIEW";
}

/** Whether a brief may be approved from SUBMITTED or IN_REVIEW. */
export function canApproveBrief(
  briefStatus: BriefStatus,
  projectStatus: ProjectStatus
): boolean {
  if (projectStatus === "ARCHIVED") return false;
  if (briefStatus === "ARCHIVED") return false;
  if (briefStatus === "APPROVED") return false;
  if (briefStatus === "DRAFT") return false;
  return briefStatus === "SUBMITTED" || briefStatus === "IN_REVIEW";
}

/** Read-only lifecycle message for non-DRAFT brief states. */
export function getBriefReadOnlyMessage(
  briefStatus: BriefStatus,
  projectStatus: ProjectStatus,
  options: { intakeForm?: boolean } = {}
): string | null {
  if (projectStatus === "ARCHIVED") {
    return options.intakeForm
      ? "This project is archived. The master brief is read-only."
      : null;
  }
  if (briefStatus === "ARCHIVED") {
    return options.intakeForm
      ? "This brief is archived and read-only."
      : "This brief is archived and read-only.";
  }
  if (briefStatus === "SUBMITTED") {
    return options.intakeForm
      ? "This brief has been submitted and is ready for review. Reopen it to make changes, or approve it when final."
      : "This brief has been submitted and is ready for review.";
  }
  if (briefStatus === "IN_REVIEW") {
    return options.intakeForm
      ? "This brief is in review and read-only. Reopen it to make changes, or approve it when final."
      : "This brief is in review and read-only.";
  }
  if (briefStatus === "APPROVED") {
    return options.intakeForm
      ? "This brief is approved and locked. It is ready for downstream strategy and creative work."
      : "This brief is approved and locked.";
  }
  return null;
}
