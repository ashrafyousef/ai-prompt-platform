"use client";

import { ProjectDetailPage } from "@/components/admin/detail/ProjectDetailPage";

export default function ProjectWorkspaceRoute({ params }: { params: { projectId: string } }) {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <ProjectDetailPage projectId={params.projectId} />
    </main>
  );
}
