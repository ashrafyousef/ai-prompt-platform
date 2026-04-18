"use client";

import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import type { AgentDraft } from "@/hooks/useAgentWizard";
import {
  validateBehavior,
  validateIdentity,
  validateKnowledge,
  validateOutput,
} from "@/hooks/useAgentWizard";
import { AgentStatusBadge } from "@/components/admin/AgentStatusBadge";
import { AgentScopeBadge } from "@/components/admin/AgentScopeBadge";
import {
  type HealthStatus,
  type ReadinessItem,
  StatusIcon,
  sectionStatus,
  ReadinessBlock,
} from "@/components/admin/shared/ConfigHealthStatus";

function SectionCard({
  title,
  status,
  children,
}: {
  title: string;
  status: HealthStatus;
  children: React.ReactNode;
}) {
  const borderColor =
    status === "fail"
      ? "border-red-200 dark:border-red-900/60"
      : status === "warn"
      ? "border-amber-200 dark:border-amber-900/60"
      : "border-zinc-200 dark:border-zinc-700";

  return (
    <div className={`rounded-xl border ${borderColor} bg-zinc-50/50 p-5 dark:bg-zinc-900/50`}>
      <div className="mb-3 flex items-center gap-2">
        <StatusIcon status={status} size="md" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {title}
        </h3>
      </div>
      <div className="text-sm text-zinc-700 dark:text-zinc-300">{children}</div>
    </div>
  );
}

function computeReadiness(d: AgentDraft) {
  const identityErrors = validateIdentity(d);
  const behaviorErrors = validateBehavior(d);
  const knowledgeErrors = validateKnowledge(d);
  const outputErrors = validateOutput(d);

  const blocking: ReadinessItem[] = [
    ...identityErrors.map((m) => ({
      message: m,
      fix: m.includes("name") ? "Go to Identity and enter an agent name." : "Go to Identity and assign a team.",
    })),
    ...behaviorErrors.map((m) => ({
      message: m,
      fix: "Go to Behavior and add system instructions.",
    })),
    ...knowledgeErrors.map((m) => ({
      message: m,
      fix: "Go to Knowledge and ensure every item has a title and content or file.",
    })),
    ...outputErrors.map((m) => ({
      message: m,
      fix: m.includes("Fallback")
        ? "Go to Output and define fallback behavior."
        : m.includes("schema")
        ? "Go to Output and add at least one JSON field."
        : m.includes("Template")
        ? "Go to Output and add template body text."
        : m.includes("section")
        ? "Go to Output and add or title required sections."
        : "Go to Output and review configuration.",
    })),
  ];

  const recommended: ReadinessItem[] = [];
  const confidence: ReadinessItem[] = [];

  if (!d.description.trim()) {
    recommended.push({
      message: "Description is empty. Users can't tell what this agent does.",
      fix: "Add a short description in Identity.",
    });
  }
  if (d.citationsPolicy === "required" && d.knowledgeSources.length === 0) {
    recommended.push({
      message: "Citations required but no knowledge sources are attached.",
      fix: "Add knowledge sources or change citations policy to optional.",
    });
  }
  if (
    d.structuredSections.length === 0 &&
    d.outputMode !== "json" &&
    d.outputMode !== "template"
  ) {
    recommended.push({
      message: "No required sections. Responses may vary in structure.",
      fix: "Add sections in Output for consistent response anchors.",
    });
  }
  if (d.outputMode === "json" && d.jsonSchema.length < 2) {
    recommended.push({
      message: "JSON schema has very few fields.",
      fix: "Add more schema fields if downstream consumers expect richer data.",
    });
  }

  if (d.knowledgeSources.length === 0) {
    confidence.push({
      message: "No knowledge sources. Agent relies only on base instructions.",
      fix: "Add knowledge sources for domain-specific reliability.",
    });
  }
  if (!d.starterPrompts.some((p) => p.text.trim())) {
    confidence.push({
      message: "No starter prompts. Users see an empty quick-start area.",
      fix: "Add 2-4 high-value starter prompts.",
    });
  }
  if (!d.fallbackBehavior.trim() && blocking.every((b) => !b.message.includes("Fallback"))) {
    confidence.push({
      message: "No fallback behavior. Agent has no uncertainty guidance.",
      fix: "Add fallback instructions in Output.",
    });
  }
  if (d.behaviorRules.trim().length < 10 && d.systemInstructions.length > 0) {
    confidence.push({
      message: "Behavior rules are very short.",
      fix: "Add specific do/don't rules in Behavior to reduce ambiguity.",
    });
  }
  if (!d.toneGuidance.trim() && d.systemInstructions.length > 0) {
    confidence.push({
      message: "No tone guidance. Agent uses a default conversational tone.",
      fix: "Add tone guidance in Behavior if specific voice matters.",
    });
  }

  return { blocking, recommended, confidence };
}

export function AgentReviewStep({
  draft,
  saving,
  onSaveDraft,
  onPublish,
  onGoBack,
}: {
  draft: AgentDraft;
  saving: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onGoBack: () => void;
}) {
  const { blocking, recommended, confidence } = computeReadiness(draft);
  const canPublish = blocking.length === 0;

  const identityErrors = validateIdentity(draft);
  const behaviorErrors = validateBehavior(draft);
  const knowledgeErrors = validateKnowledge(draft);
  const outputErrors = validateOutput(draft);

  const hasStarters = draft.starterPrompts.some((p) => p.text.trim());
  const hasKnowledge = draft.knowledgeSources.length > 0;
  const hasDescription = Boolean(draft.description.trim());
  const readySections = [
    identityErrors.length === 0 ? 1 : 0,
    behaviorErrors.length === 0 ? 1 : 0,
    knowledgeErrors.length === 0 ? 1 : 0,
    outputErrors.length === 0 ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Review &amp; Publish
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Review your configuration. Save as draft to continue later, or publish to make the agent available to users.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Publish readiness
        </p>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-100">
          {readySections}/4 core sections pass · {blocking.length === 0 ? "Ready to publish" : `${blocking.length} blocking`}
          {recommended.length > 0 ? ` · ${recommended.length} recommended` : ""}
          {confidence.length > 0 ? ` · ${confidence.length} confidence` : ""}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Blocking = must fix. Recommended = improves quality. Confidence = reduces risk.
        </p>
      </div>

      <ReadinessBlock
        level="blocking"
        title="Blocking — fix before publishing"
        items={blocking}
      />

      <ReadinessBlock
        level="recommended"
        title="Recommended — improves agent quality"
        items={recommended}
      />

      <ReadinessBlock
        level="confidence"
        title="Confidence — consider addressing"
        items={confidence}
      />

      {blocking.length === 0 && recommended.length === 0 && confidence.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All checks pass. Ready to publish.
          </p>
        </div>
      ) : null}

      {/* Section cards */}
      <div className="space-y-3">
        {/* Identity */}
        <SectionCard
          title="Identity"
          status={sectionStatus(identityErrors, !hasDescription)}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{draft.icon}</span>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {draft.name || "Untitled"}
              </p>
              <p className="text-xs text-zinc-500">
                {draft.description || "No description"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <AgentStatusBadge
              status={draft.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}
            />
            <AgentScopeBadge scope={draft.scope} />
            {draft.category ? (
              <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                {draft.category}
              </span>
            ) : null}
          </div>
        </SectionCard>

        {/* Behavior */}
        <SectionCard
          title="Behavior"
          status={sectionStatus(
            behaviorErrors,
            !draft.toneGuidance.trim() || draft.behaviorRules.trim().length < 10
          )}
        >
          <p className="line-clamp-3 whitespace-pre-wrap text-xs">
            {draft.systemInstructions || "—"}
          </p>
          {draft.behaviorRules ? (
            <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
              Rules: {draft.behaviorRules}
            </p>
          ) : null}
          <p className="mt-2 text-[11px] text-zinc-400">
            Temp: {draft.temperature} · Max tokens: {draft.maxTokens}
            {draft.strictMode ? " · Strict" : ""}
          </p>
        </SectionCard>

        {/* Knowledge */}
        <SectionCard
          title={`Knowledge (${draft.knowledgeSources.length})`}
          status={sectionStatus(knowledgeErrors, !hasKnowledge)}
        >
          {draft.knowledgeSources.length === 0 ? (
            <p className="text-xs text-zinc-500">None attached.</p>
          ) : (
            <ul className="space-y-1">
              {draft.knowledgeSources.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="truncate">
                    {k.title} ({k.sourceType})
                  </span>
                  <span className="ml-2 shrink-0 text-[10px] text-zinc-400">
                    {k.fileRef?.url
                      ? "uploaded"
                      : k.content
                      ? `${(k.content.length / 1000).toFixed(1)}k`
                      : "empty"}
                    {!k.isActive ? " · inactive" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Output */}
        <SectionCard
          title="Output"
          status={sectionStatus(outputErrors, false)}
        >
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {draft.outputMode.replace("-", " ")}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {draft.responseDepth}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              Citations: {draft.citationsPolicy}
            </span>
          </div>
          {draft.outputMode === "structured-markdown" &&
          draft.structuredSections.length > 0 ? (
            <p className="mt-2 text-xs text-zinc-500">
              Sections:{" "}
              {draft.structuredSections
                .map((s) => s.title || "Untitled")
                .join(", ")}
            </p>
          ) : null}
          {draft.outputMode === "json" && draft.jsonSchema.length > 0 ? (
            <p className="mt-2 text-xs text-zinc-500">
              Fields:{" "}
              {draft.jsonSchema
                .map((f) => f.name || "unnamed")
                .join(", ")}
            </p>
          ) : null}
          {draft.fallbackBehavior ? (
            <p className="mt-2 text-xs text-zinc-500">
              Fallback:{" "}
              {draft.fallbackBehavior.length > 100
                ? draft.fallbackBehavior.slice(0, 100) + "…"
                : draft.fallbackBehavior}
            </p>
          ) : null}
        </SectionCard>

        {/* Starter prompts */}
        <SectionCard
          title={`Starter prompts (${draft.starterPrompts.filter((p) => p.text.trim()).length})`}
          status={sectionStatus([], !hasStarters)}
        >
          {!hasStarters ? (
            <p className="text-xs text-zinc-500">
              None added. Users see an empty chat with no starting guidance.
            </p>
          ) : (
            <ul className="space-y-1">
              {draft.starterPrompts
                .filter((p) => p.text.trim())
                .map((p) => (
                  <li key={p.id} className="line-clamp-1 text-xs">
                    {p.text}
                  </li>
                ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save as Draft
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={saving || !canPublish}
          title={
            canPublish
              ? recommended.length > 0 || confidence.length > 0
                ? "Publish is available. Review non-blocking suggestions first if needed."
                : "All checks pass. Ready to publish."
              : `Fix ${blocking.length} blocking issue${blocking.length > 1 ? "s" : ""} before publishing.`
          }
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Publish
        </button>
        <button
          type="button"
          onClick={onGoBack}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Return to previous step
        </button>
      </div>
    </div>
  );
}
