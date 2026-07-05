"use client";

import { AgentSummaryCard } from "./AgentSummaryCard";
import { buildBriefHandoffSections } from "@/lib/briefHandoff";
import type { BriefDocumentV2 } from "@/lib/briefIntake";

function HandoffField({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{value}</p>
    </div>
  );
}

export function ApprovedBriefHandoffPanel({ document }: { document: BriefDocumentV2 }) {
  const sections = buildBriefHandoffSections(document);

  return (
    <AgentSummaryCard title="Approved Brief Handoff">
      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.id} className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <h3 className="pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {section.title}
            </h3>
            {section.rows.map((row) => (
              <HandoffField key={row.key} label={row.label} value={row.value} />
            ))}
          </div>
        ))}

        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Next stage: Strategy &amp; Planning
          </h3>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            This upcoming stage will help translate the approved brief into a strategic
            direction before creative kickoff.
          </p>
          <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">Coming next in Phase 2G.</p>
        </div>
      </div>
    </AgentSummaryCard>
  );
}
