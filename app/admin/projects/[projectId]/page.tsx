"use client";

import { ProjectDetailPage } from "@/components/admin/detail/ProjectDetailPage";

export default function AdminProjectDetailRoute({ params }: { params: { projectId: string } }) {
  return <ProjectDetailPage projectId={params.projectId} />;
}
