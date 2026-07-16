import type { ReactNode } from "react";
import { ProjectAccessProvider } from "@/components/projects/ProjectAccessProvider";
import { getProjectSessionOrRedirect } from "@/lib/projectActorContext";

/**
 * Phase 4B.2: DB-backed project actor gate for all workspace roles.
 * Middleware admits authenticated workspace users; this layout revalidates from the database.
 */
export default async function ProjectsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { viewer } = await getProjectSessionOrRedirect();
  return <ProjectAccessProvider viewer={viewer}>{children}</ProjectAccessProvider>;
}
