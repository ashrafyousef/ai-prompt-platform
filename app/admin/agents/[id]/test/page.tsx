"use client";

import { AgentTestSandbox } from "@/components/admin/detail/AgentTestSandbox";

export default function AdminAgentTestRoute({ params }: { params: { id: string } }) {
  return <AgentTestSandbox agentId={params.id} />;
}
