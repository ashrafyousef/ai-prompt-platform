import { ApprovedBriefHandoffPanel } from "@/components/admin/detail/ApprovedBriefHandoffPanel";
import { StrategyDirectionPanel } from "@/components/admin/detail/StrategyDirectionPanel";
import { StrategyWorkflowSpine } from "@/components/admin/detail/StrategyWorkflowSpine";
import { Panel, StatusChip } from "@/components/ui";
import type { BriefStatus, ProjectDetail } from "./types";

export type ProjectStrategyPanelProps = {
  project: ProjectDetail;
  briefStatus: BriefStatus;
};

export function ProjectStrategyPanel({ project, briefStatus }: ProjectStrategyPanelProps) {
  if (!project.brief || briefStatus !== "APPROVED") {
    return (
      <Panel
        id="strategy"
        title="Strategy"
        description="Strategy direction becomes available once the project brief is approved."
        padding="md"
        className="scroll-mt-6"
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Approve the brief to unlock strategy direction and creative handoff preparation.
        </p>
      </Panel>
    );
  }

  const strategy = project.strategy;

  return (
    <div id="strategy" className="scroll-mt-6 space-y-4">
      <Panel
        title="Strategy"
        description="Shape the strategic direction that will guide creative work."
        padding="md"
        actions={
          strategy ? (
            <StatusChip
              status={strategy.status === "READY_FOR_CREATIVE" ? "ready" : strategy.status === "ARCHIVED" ? "archived" : "draft"}
              label={strategy.status.replace(/_/g, " ")}
            />
          ) : null
        }
      >
        <StrategyWorkflowSpine strategyStatus={strategy?.status ?? null} />
      </Panel>

      <ApprovedBriefHandoffPanel document={project.brief.responsesJson} />

      <StrategyDirectionPanel projectId={project.id} initialStrategy={strategy} />
    </div>
  );
}
