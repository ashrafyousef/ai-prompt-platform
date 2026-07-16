"use client";

import { ProjectDetailPage } from "@/components/admin/detail/ProjectDetailPage";
import { MemberProjectDetailPage } from "@/components/projects/MemberProjectDetailPage";
import { useProjectAccess } from "@/components/projects/ProjectAccessProvider";

export default function ProjectWorkspaceRoute({ params }: { params: { projectId: string } }) {
  const { canManageProjects } = useProjectAccess();

  return (
    <main className="mx-auto max-w-6xl p-6">
      {canManageProjects ? (
        <ProjectDetailPage projectId={params.projectId} />
      ) : (
        <MemberProjectDetailPage projectId={params.projectId} />
      )}
    </main>
  );
}
