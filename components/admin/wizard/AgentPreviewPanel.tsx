"use client";

import type { WizardStep, AgentDraft } from "@/hooks/useAgentWizard";
import { AgentStatusBadge } from "@/components/admin/AgentStatusBadge";
import { AgentScopeBadge } from "@/components/admin/AgentScopeBadge";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {children}
    </div>
  );
}

function IdentityPreview({ d }: { d: AgentDraft }) {
  return (
    <Card>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">User sees</p>
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <span className="text-3xl">{d.icon}</span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
            {d.name || "Agent Name"}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
            {d.description || "Short description goes here…"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <AgentScopeBadge scope={d.scope} />
        {d.category ? (
          <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 dark:border-zinc-700">
            {d.category}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function BehaviorPreview({ d }: { d: AgentDraft }) {
  return (
    <Card>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Behavior summary</p>
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

function KnowledgePreview({ d }: { d: AgentDraft }) {
  return (
    <Card>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Knowledge sources</p>
      {d.knowledgeSources.length === 0 ? (
        <p className="text-xs text-zinc-400">No knowledge added.</p>
      ) : (
        <ul className="space-y-2">
          {d.knowledgeSources.map((k) => (
            <li key={k.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">{k.title}</p>
              <p className="text-zinc-500">{k.type} · {(k.content.length / 1000).toFixed(1)}k chars</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OutputPreview({ d }: { d: AgentDraft }) {
  return (
    <Card>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Response format</p>
      <p className="text-sm font-medium capitalize text-zinc-800 dark:text-zinc-200">
        {d.outputMode.replace("-", " ")}
      </p>
      {d.outputMode === "structured-markdown" && d.structuredSections.length > 0 ? (
        <div className="mt-3 space-y-1">
          {d.structuredSections.map((s) => (
            <p key={s.id} className="text-xs text-zinc-600 dark:text-zinc-400">
              ## {s.title || "Section"} {s.required ? "(required)" : "(optional)"}
            </p>
          ))}
        </div>
      ) : null}
      {d.outputMode === "json" && d.jsonSchema.length > 0 ? (
        <pre className="mt-3 overflow-auto rounded-lg bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-300">
          {"{\n"}
          {d.jsonSchema.map((f) => `  "${f.name || "field"}": ${f.type}`).join(",\n")}
          {"\n}"}
        </pre>
      ) : null}
      {d.outputMode === "template" && d.templateText ? (
        <pre className="mt-3 line-clamp-8 overflow-auto rounded-lg bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-300">
          {d.templateText}
        </pre>
      ) : null}
    </Card>
  );
}

function StarterPreview({ d }: { d: AgentDraft }) {
  return (
    <Card>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Quick-start cards</p>
      {d.starterPrompts.length === 0 ? (
        <p className="text-xs text-zinc-400">No starter prompts.</p>
      ) : (
        <div className="grid gap-2">
          {d.starterPrompts.slice(0, 4).map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {p.text || "Empty prompt…"}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AgentPreviewPanel({ step, draft }: { step: WizardStep; draft: AgentDraft }) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Live preview</p>
      {step === "import-method" || step === "identity" ? <IdentityPreview d={draft} /> : null}
      {step === "behavior" ? <BehaviorPreview d={draft} /> : null}
      {step === "knowledge" ? <KnowledgePreview d={draft} /> : null}
      {step === "output" ? <OutputPreview d={draft} /> : null}
      {step === "starter-prompts" ? <StarterPreview d={draft} /> : null}
      {step === "review" ? (
        <>
          <IdentityPreview d={draft} />
          <BehaviorPreview d={draft} />
          <OutputPreview d={draft} />
        </>
      ) : null}
    </div>
  );
}
