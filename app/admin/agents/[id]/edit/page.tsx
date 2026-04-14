"use client";

import { AgentEditPage } from "@/components/admin/detail/AgentEditPage";

export default function AdminAgentEditRoute({ params }: { params: { id: string } }) {
  return <AgentEditPage agentId={params.id} />;
}
