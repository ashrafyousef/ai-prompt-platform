"use client";

import { Panel, StatusChip } from "@/components/ui";
import {
  STRATEGY_FIELD_DEFINITIONS,
  type StrategyFieldKey,
} from "@/lib/strategyDocument";
import {
  STRATEGY_PREFILLED_BADGE_LABEL,
  formatStrategyReadOnlyValue,
  isStrategyPrefilledField,
} from "@/lib/strategyUi";
import type { StrategySummary } from "./types";
import { formatProjectDateTime } from "./types";

function strategyStatusLabel(status: StrategySummary["status"]): string {
  switch (status) {
    case "READY_FOR_CREATIVE":
      return "Ready for Creative";
    case "ARCHIVED":
      return "Archived";
    default:
      return "Draft";
  }
}

function PrefilledBadge() {
  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
      {STRATEGY_PREFILLED_BADGE_LABEL}
    </span>
  );
}

export function MemberProjectStrategySection({
  strategy,
}: {
  strategy: StrategySummary | null;
}) {
  if (!strategy) {
    return (
      <Panel title="Strategy direction" description="Strategic direction for this project." padding="md">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No strategy direction has been added to this project yet.
        </p>
      </Panel>
    );
  }

  const groups = new Map<string, Array<{ key: StrategyFieldKey; label: string }>>();
  for (const field of STRATEGY_FIELD_DEFINITIONS) {
    const items = groups.get(field.group) ?? [];
    items.push({ key: field.key, label: field.label });
    groups.set(field.group, items);
  }

  return (
    <Panel title="Strategy direction" description="Read-only strategy content." padding="md">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status="draft" label={strategyStatusLabel(strategy.status)} />
          {strategy.readyAt ? (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Ready {formatProjectDateTime(strategy.readyAt)}
            </span>
          ) : null}
        </div>

        {Array.from(groups.entries()).map(([group, fields]) => (
          <div key={group} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {group}
            </p>
            {fields.map((field) => {
              const value = strategy.responsesJson.fields[field.key];
              const prefilled = isStrategyPrefilledField(field.key);
              return (
                <div
                  key={field.key}
                  className="border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {field.label}
                    </p>
                    {prefilled ? <PrefilledBadge /> : null}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                    {formatStrategyReadOnlyValue(value)}
                  </p>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Panel>
  );
}
