import { Button, InlineActions, Panel, StatusChip } from "@/components/ui";
import type { StatusChipStatus } from "@/components/ui";
import { BriefAnalysisPanel } from "@/components/admin/detail/BriefAnalysisPanel";
import { BriefIntakeForm } from "@/components/admin/detail/BriefIntakeForm";
import { RawBriefPanel } from "@/components/admin/detail/RawBriefPanel";
import type { BriefStatus, ProjectDetail } from "./types";
import { formatProjectDate, formatProjectDateTime } from "./types";

function briefStatusToChip(status: string): StatusChipStatus {
  switch (status) {
    case "SUBMITTED":
      return "submitted";
    case "IN_REVIEW":
      return "in_review";
    case "APPROVED":
      return "approved";
    case "ARCHIVED":
      return "archived";
    default:
      return "draft";
  }
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="text-right text-xs font-medium text-zinc-700 dark:text-zinc-300">{value}</span>
    </div>
  );
}

export type ProjectBriefPanelProps = {
  project: ProjectDetail;
  briefStatus: BriefStatus;
  canCreateBrief: boolean;
  showReopenBrief: boolean;
  showApproveBrief: boolean;
  creatingBrief: boolean;
  reopeningBrief: boolean;
  approvingBrief: boolean;
  lifecycleBusy: boolean;
  onCreateBrief: () => void;
  onReopenBrief: () => void;
  onApproveBrief: () => void;
  onSaved: (message: string) => void;
  onAnalyzed: (message: string) => void;
  onApplied: (message: string) => void;
  onError: (message: string | null) => void;
};

export function ProjectBriefPanel({
  project,
  briefStatus,
  canCreateBrief,
  showReopenBrief,
  showApproveBrief,
  creatingBrief,
  reopeningBrief,
  approvingBrief,
  lifecycleBusy,
  onCreateBrief,
  onReopenBrief,
  onApproveBrief,
  onSaved,
  onAnalyzed,
  onApplied,
  onError,
}: ProjectBriefPanelProps) {
  const brief = project.brief;

  return (
    <div id="brief" className="scroll-mt-6 space-y-4">
      <Panel
        title="Brief"
        description="Capture and review the project brief before strategy and creative work."
        actions={
          canCreateBrief || showReopenBrief || showApproveBrief ? (
            <InlineActions>
              {canCreateBrief ? (
                <Button type="button" size="sm" onClick={onCreateBrief} disabled={creatingBrief}>
                  {creatingBrief ? "Creating..." : "Create brief"}
                </Button>
              ) : null}
              {showReopenBrief ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onReopenBrief}
                  disabled={lifecycleBusy}
                >
                  {reopeningBrief ? "Reopening..." : "Reopen brief"}
                </Button>
              ) : null}
              {showApproveBrief ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={onApproveBrief}
                  disabled={lifecycleBusy}
                >
                  {approvingBrief ? "Approving..." : "Approve brief"}
                </Button>
              ) : null}
            </InlineActions>
          ) : null
        }
        padding="md"
      >
        {brief ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <MetadataRow label="Title" value={brief.title} />
            <div className="flex items-baseline justify-between gap-4 py-1.5">
              <span className="text-xs text-zinc-400">Status</span>
              <StatusChip status={briefStatusToChip(brief.status)} label={brief.status.replace(/_/g, " ")} />
            </div>
            <MetadataRow label="Created" value={formatProjectDate(brief.createdAt)} />
            <MetadataRow label="Updated" value={formatProjectDate(brief.updatedAt)} />
            <MetadataRow
              label="Submitted"
              value={brief.submittedAt ? formatProjectDateTime(brief.submittedAt) : "—"}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No brief linked to this project yet.
            </p>
            {project.status === "ARCHIVED" ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Briefs cannot be created for archived projects.
              </p>
            ) : null}
          </div>
        )}
      </Panel>

      <RawBriefPanel
        briefId={brief?.id ?? null}
        briefStatus={brief?.status ?? "DRAFT"}
        projectStatus={project.status}
        document={brief?.responsesJson ?? null}
        onSaved={onSaved}
        onAnalyzed={onAnalyzed}
        onError={onError}
      />

      <BriefAnalysisPanel
        briefId={brief?.id ?? null}
        briefStatus={brief?.status ?? "DRAFT"}
        projectStatus={project.status}
        document={brief?.responsesJson ?? null}
        onApplied={onApplied}
        onError={onError}
      />

      <BriefIntakeForm
        brief={brief}
        projectStatus={project.status}
        onSaved={onSaved}
            onError={(message) => onError(message)}
      />
    </div>
  );
}
