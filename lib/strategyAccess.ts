import type { ProjectStatus, StrategyStatus } from "@prisma/client";
import type { WorkspaceMemberManagerContext } from "@/lib/adminAuth";
import {
  canViewProjectForActor,
  toProjectActorContextFromManager,
  type ProjectAccessTarget,
  type ProjectActorContext,
} from "@/lib/projectAccess";

export type StrategyAccessProject = ProjectAccessTarget & { id: string };

/** Strategy visibility inherits parent project visibility rules — same gate as Brief. */
export function canViewStrategyForActor(
  actor: ProjectActorContext,
  project: StrategyAccessProject
): boolean {
  return canViewProjectForActor(actor, project, { includeArchivedProjects: true });
}

export function toStrategyActorContextFromManager(
  auth: WorkspaceMemberManagerContext
): ProjectActorContext {
  return toProjectActorContextFromManager(auth);
}

/** Whether strategy responses may be edited — only while DRAFT, project not archived. */
export function canEditStrategyResponses(
  strategyStatus: StrategyStatus,
  projectStatus: ProjectStatus
): boolean {
  if (projectStatus === "ARCHIVED") return false;
  if (strategyStatus === "ARCHIVED") return false;
  return strategyStatus === "DRAFT";
}

/** Whether a strategy may be marked READY_FOR_CREATIVE — only forward, from DRAFT. */
export function canMarkStrategyReady(
  strategyStatus: StrategyStatus,
  projectStatus: ProjectStatus
): boolean {
  if (projectStatus === "ARCHIVED") return false;
  return strategyStatus === "DRAFT";
}
