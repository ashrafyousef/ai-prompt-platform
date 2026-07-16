"use client";

import { createContext, useContext } from "react";

export type ProjectAccessViewer = {
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  platformRole: "USER" | "TEAM_LEAD" | "ADMIN" | null;
  teamId: string | null;
  canManageProjects: boolean;
};

const ProjectAccessContext = createContext<ProjectAccessViewer | null>(null);

export function ProjectAccessProvider({
  viewer,
  children,
}: {
  viewer: ProjectAccessViewer;
  children: React.ReactNode;
}) {
  return (
    <ProjectAccessContext.Provider value={viewer}>{children}</ProjectAccessContext.Provider>
  );
}

export function useProjectAccess(): ProjectAccessViewer {
  const context = useContext(ProjectAccessContext);
  if (!context) {
    throw new Error("useProjectAccess must be used within ProjectAccessProvider");
  }
  return context;
}
