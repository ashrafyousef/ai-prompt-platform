"use client";

import { AgentDetailPage } from "@/components/admin/detail/AgentDetailPage";

export default function AdminAgentDetailRoute({ params }: { params: { id: string } }) {
  return <AgentDetailPage agentId={params.id} />;
}
