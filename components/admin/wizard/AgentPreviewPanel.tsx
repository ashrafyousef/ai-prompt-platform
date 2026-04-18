"use client";

import {
  FileText,
  MessageSquare,
  Brain,
  Layout,
  Zap,
  BookOpen,
  Sparkles,
} from "lucide-react";
import type { WizardStep, AgentDraft } from "@/hooks/useAgentWizard";
import {
  validateIdentity,
  validateBehavior,
  validateKnowledge,
  validateOutput,
} from "@/hooks/useAgentWizard";
import { AgentScopeBadge } from "@/components/admin/AgentScopeBadge";
import { type HealthStatus, StatusIcon } from "@/components/admin/shared/ConfigHealthStatus";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {children}
    </div>
  );
}

function Chip({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "violet" | "emerald" | "amber";
}) {
  const styles = {
    default:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    violet:
      "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400",
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
    amber:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Always-visible: Agent snapshot                                      */
/* ------------------------------------------------------------------ */

function AgentSnapshot({ d }: { d: AgentDraft }) {
  const activeKnowledge = d.knowledgeSources.filter((k) => k.isActive).length;
  const hasStarters = d.starterPrompts.some((p) => p.text.trim());
  const starterCount = d.starterPrompts.filter((p) => p.text.trim()).length;
  const hasDescription = Boolean(d.description.trim());

  return (
    <Card>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        What users will see
      </p>
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
        <span className="text-2xl leading-none">{d.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {d.name || "Untitled agent"}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            {d.description || "No description yet"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <AgentScopeBadge scope={d.scope} />
        {d.category ? (
          <Chip>{d.category}</Chip>
        ) : null}
        <Chip variant={activeKnowledge > 0 ? "violet" : "default"}>
          <BookOpen className="h-2.5 w-2.5" />
          {activeKnowledge > 0 ? `${activeKnowledge} source${activeKnowledge > 1 ? "s" : ""}` : "No knowledge"}
        </Chip>
        <Chip variant={hasStarters ? "emerald" : "default"}>
          <MessageSquare className="h-2.5 w-2.5" />
          {hasStarters ? `${starterCount} starter${starterCount > 1 ? "s" : ""}` : "No starters"}
        </Chip>
      </div>

      {!hasDescription && d.name.trim() ? (
        <p className="mt-2.5 text-[10px] italic text-amber-500">
          Add a description so users understand what this agent does.
        </p>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Always-visible: User impression                                     */
/* ------------------------------------------------------------------ */

function UserImpression({ d }: { d: AgentDraft }) {
  const activeKnowledge = d.knowledgeSources.filter((k) => k.isActive).length;
  const fileBased = d.knowledgeSources.filter((k) => k.fileRef?.url).length;
  const hasFallback = Boolean(d.fallbackBehavior.trim());
  const hasTone = Boolean(d.toneGuidance.trim());

  const modeLabel: Record<string, string> = {
    markdown: "free-form markdown",
    "structured-markdown": "structured sections",
    json: "JSON schema",
    template: "template-based",
  };

  const lines: Array<{ icon: React.ReactNode; text: string }> = [];

  lines.push({
    icon: <Layout className="h-3 w-3 text-zinc-400" />,
    text: `${d.responseDepth} ${modeLabel[d.outputMode] ?? d.outputMode} responses`,
  });

  if (d.citationsPolicy !== "none") {
    lines.push({
      icon: <Sparkles className="h-3 w-3 text-zinc-400" />,
      text: `Citations ${d.citationsPolicy}`,
    });
  }

  if (activeKnowledge > 0) {
    const parts = [`${activeKnowledge} active source${activeKnowledge > 1 ? "s" : ""}`];
    if (fileBased > 0) parts.push(`${fileBased} file-based`);
    lines.push({
      icon: <BookOpen className="h-3 w-3 text-zinc-400" />,
      text: parts.join(", "),
    });
  } else {
    lines.push({
      icon: <BookOpen className="h-3 w-3 text-amber-400" />,
      text: "No knowledge — relies on base instructions only",
    });
  }

  if (hasTone) {
    lines.push({
      icon: <Brain className="h-3 w-3 text-zinc-400" />,
      text: `Tone: ${d.toneGuidance.slice(0, 60)}${d.toneGuidance.length > 60 ? "…" : ""}`,
    });
  }

  if (!hasFallback) {
    lines.push({
      icon: <Brain className="h-3 w-3 text-amber-400" />,
      text: "No fallback — uncertain queries have no safety net",
    });
  }

  return (
    <Card>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Agent personality
      </p>
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">{line.icon}</span>
            <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
              {line.text}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Always-visible: Configuration health                                */
/* ------------------------------------------------------------------ */

function getHealthRows(d: AgentDraft) {
  const identityErrors = validateIdentity(d);
  const behaviorErrors = validateBehavior(d);
  const knowledgeErrors = validateKnowledge(d);
  const outputErrors = validateOutput(d);

  const hasDescription = Boolean(d.description.trim());
  const hasKnowledge = d.knowledgeSources.length > 0;
  const hasStarters = d.starterPrompts.some((p) => p.text.trim());
  const hasFallback = Boolean(d.fallbackBehavior.trim());

  const rows: Array<{
    icon: React.ReactNode;
    label: string;
    status: HealthStatus;
    detail: string;
    fix: string;
  }> = [
    {
      icon: <Zap className="h-3.5 w-3.5" />,
      label: "Identity",
      status: identityErrors.length > 0 ? "fail" : !hasDescription ? "warn" : "pass",
      detail:
        identityErrors.length > 0
          ? identityErrors[0]
          : !hasDescription
          ? "Users can't tell what this agent does."
          : d.name,
      fix:
        identityErrors.length > 0
          ? "Go to Identity and fill required fields."
          : !hasDescription
          ? "Add a short description in Identity."
          : "",
    },
    {
      icon: <Brain className="h-3.5 w-3.5" />,
      label: "Behavior",
      status: behaviorErrors.length > 0 ? "fail" : "pass",
      detail:
        behaviorErrors.length > 0
          ? behaviorErrors[0]
          : `${d.systemInstructions.length} chars · Temp ${d.temperature}`,
      fix:
        behaviorErrors.length > 0
          ? "Go to Behavior and add system instructions."
          : "",
    },
    {
      icon: <FileText className="h-3.5 w-3.5" />,
      label: "Knowledge",
      status:
        knowledgeErrors.length > 0
          ? "fail"
          : !hasKnowledge
          ? "warn"
          : "pass",
      detail:
        knowledgeErrors.length > 0
          ? knowledgeErrors[0]
          : !hasKnowledge
          ? "Agent relies only on base instructions."
          : `${d.knowledgeSources.filter((k) => k.isActive).length} active / ${d.knowledgeSources.length} total`,
      fix:
        knowledgeErrors.length > 0
          ? "Fix incomplete items in Knowledge."
          : !hasKnowledge
          ? "Add at least one source in Knowledge."
          : "",
    },
    {
      icon: <Layout className="h-3.5 w-3.5" />,
      label: "Output",
      status:
        outputErrors.length > 0
          ? "fail"
          : !hasFallback
          ? "warn"
          : "pass",
      detail:
        outputErrors.length > 0
          ? outputErrors[0]
          : !hasFallback
          ? "No fallback when constraints can't be met."
          : `${d.outputMode.replace("-", " ")} · ${d.responseDepth}`,
      fix:
        outputErrors.length > 0
          ? "Fix issues in Output step."
          : !hasFallback
          ? "Add fallback behavior in Output."
          : "",
    },
    {
      icon: <MessageSquare className="h-3.5 w-3.5" />,
      label: "Starters",
      status: !hasStarters ? "warn" : "pass",
      detail: !hasStarters
        ? "Users see an empty quick-start area."
        : `${d.starterPrompts.filter((p) => p.text.trim()).length} prompt(s)`,
      fix: !hasStarters ? "Add starter prompts so users know how to begin." : "",
    },
  ];

  return rows;
}

function ConfigurationHealth({ d }: { d: AgentDraft }) {
  const rows = getHealthRows(d);
  const failCount = rows.filter((r) => r.status === "fail").length;
  const warnCount = rows.filter((r) => r.status === "warn").length;
  const passCount = rows.filter((r) => r.status === "pass").length;

  const summaryLabel =
    failCount > 0
      ? `${failCount} blocking`
      : warnCount > 0
      ? `${warnCount} suggestion${warnCount > 1 ? "s" : ""}`
      : "All clear";

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Readiness
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            passCount === rows.length
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              : failCount > 0
              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
          }`}
        >
          {summaryLabel}
        </span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-2">
            <StatusIcon status={row.status} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                {row.label}
              </p>
              <p className="truncate text-[10px] text-zinc-400">{row.detail}</p>
              {row.fix ? (
                <p className="text-[10px] italic text-zinc-400">{row.fix}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Step-specific detail cards                                          */
/* ------------------------------------------------------------------ */

function BehaviorDetail({ d }: { d: AgentDraft }) {
  return (
    <Card>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Behavior detail
      </p>
      {d.systemInstructions ? (
        <p className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
          {d.systemInstructions}
        </p>
      ) : (
        <p className="text-xs text-zinc-400">No instructions defined yet.</p>
      )}
      {d.toneGuidance ? (
        <p className="mt-3 text-xs text-zinc-500">
          <strong>Tone:</strong> {d.toneGuidance.slice(0, 120)}
        </p>
      ) : null}
      <p className="mt-3 text-[11px] text-zinc-400">
        Temp {d.temperature} · {d.maxTokens} tokens{d.strictMode ? " · Strict" : ""}
      </p>
    </Card>
  );
}

function KnowledgeDetail({ d }: { d: AgentDraft }) {
  const active = d.knowledgeSources.filter((k) => k.isActive);
  const uploaded = d.knowledgeSources.filter((k) => k.fileRef?.url);
  const types = Array.from(new Set(d.knowledgeSources.map((k) => k.sourceType)));

  return (
    <Card>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Knowledge detail
      </p>
      {d.knowledgeSources.length === 0 ? (
        <p className="text-xs text-zinc-400">No knowledge added yet.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Chip variant={active.length > 0 ? "emerald" : "default"}>
              {active.length} active
            </Chip>
            <Chip>{d.knowledgeSources.length} total</Chip>
            {uploaded.length > 0 ? (
              <Chip variant="violet">{uploaded.length} file-based</Chip>
            ) : null}
            {types.length > 0 ? (
              <Chip>{types.join(", ")}</Chip>
            ) : null}
          </div>
          <ul className="space-y-2">
            {d.knowledgeSources.slice(0, 4).map((k) => (
              <li
                key={k.id}
                className="rounded-lg bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900"
              >
                <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {k.title || "Untitled"}
                </p>
                <p className="text-[10px] text-zinc-500">
                  {k.sourceType} · P{k.priority}
                  {k.fileRef?.url ? " · uploaded" : ""}
                  {k.content
                    ? ` · ${(k.content.length / 1000).toFixed(1)}k chars`
                    : ""}
                  {!k.isActive ? " · inactive" : ""}
                </p>
              </li>
            ))}
            {d.knowledgeSources.length > 4 ? (
              <p className="text-[11px] text-zinc-400">
                +{d.knowledgeSources.length - 4} more…
              </p>
            ) : null}
          </ul>
        </>
      )}
    </Card>
  );
}

function OutputDetail({ d }: { d: AgentDraft }) {
  return (
    <Card>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Output detail
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Chip>
          {d.outputMode.replace("-", " ")}
        </Chip>
        <Chip>{d.responseDepth}</Chip>
        <Chip variant={d.citationsPolicy === "required" ? "violet" : "default"}>
          Citations: {d.citationsPolicy}
        </Chip>
      </div>

      {d.outputMode === "structured-markdown" && d.structuredSections.length > 0 ? (
        <div className="mt-2 space-y-1">
          {d.structuredSections.map((s) => (
            <p key={s.id} className="text-xs text-zinc-600 dark:text-zinc-400">
              ## {s.title || "Section"}{" "}
              {s.required ? (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400">required</span>
              ) : (
                <span className="text-[10px] text-zinc-400">optional</span>
              )}
            </p>
          ))}
        </div>
      ) : null}

      {d.outputMode === "json" && d.jsonSchema.length > 0 ? (
        <pre className="mt-2 overflow-auto rounded-lg bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-300">
          {"{\n"}
          {d.jsonSchema
            .map((f) => `  "${f.name || "field"}": ${f.type}`)
            .join(",\n")}
          {"\n}"}
        </pre>
      ) : null}

      {d.outputMode === "template" && d.templateText ? (
        <pre className="mt-2 line-clamp-8 overflow-auto rounded-lg bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-300">
          {d.templateText}
        </pre>
      ) : null}

      {d.fallbackBehavior ? (
        <p className="mt-2 text-[11px] text-zinc-500">
          <span className="font-medium">Fallback:</span>{" "}
          {d.fallbackBehavior.length > 80
            ? d.fallbackBehavior.slice(0, 80) + "…"
            : d.fallbackBehavior}
        </p>
      ) : null}
    </Card>
  );
}

function StarterDetail({ d }: { d: AgentDraft }) {
  const filled = d.starterPrompts.filter((p) => p.text.trim());
  return (
    <Card>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Quick-start cards
      </p>
      {filled.length === 0 ? (
        <p className="text-xs text-zinc-400">No starter prompts yet.</p>
      ) : (
        <div className="grid gap-2">
          {filled.slice(0, 4).map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {p.text}
            </div>
          ))}
          {filled.length > 4 ? (
            <p className="text-[11px] text-zinc-400">+{filled.length - 4} more…</p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                         */
/* ------------------------------------------------------------------ */

export function AgentPreviewPanel({
  step,
  draft,
}: {
  step: WizardStep;
  draft: AgentDraft;
}) {
  const showStepDetail = step !== "review";

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Live preview
      </p>

      {/* 1. Agent snapshot — always visible, identity + signals */}
      <AgentSnapshot d={draft} />

      {/* 2. User impression — always visible, what kind of agent */}
      <UserImpression d={draft} />

      {/* 3. Readiness — always visible, compact health */}
      <ConfigurationHealth d={draft} />

      {/* 4. Step-specific detail — only when not on review */}
      {showStepDetail ? (
        <>
          {step === "behavior" || step === "guided-extraction" ? (
            <BehaviorDetail d={draft} />
          ) : null}
          {step === "knowledge" || step === "knowledge-intake" ? (
            <KnowledgeDetail d={draft} />
          ) : null}
          {step === "output" ? <OutputDetail d={draft} /> : null}
          {step === "starter-prompts" || step === "guided-extraction" ? (
            <StarterDetail d={draft} />
          ) : null}
        </>
      ) : null}

      {/* 5. Review step — show output + knowledge detail only (snapshot covers identity, starters in impression) */}
      {step === "review" ? (
        <>
          <KnowledgeDetail d={draft} />
          <OutputDetail d={draft} />
        </>
      ) : null}
    </div>
  );
}
