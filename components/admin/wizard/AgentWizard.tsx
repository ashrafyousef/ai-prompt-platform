"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useAgentWizard, canProceed, validateIdentity, validateBehavior } from "@/hooks/useAgentWizard";
import type { WizardStep } from "@/hooks/useAgentWizard";
import { WizardStepper } from "./WizardStepper";
import { AgentPreviewPanel } from "./AgentPreviewPanel";
import { ImportMethodStep } from "./ImportMethodStep";
import { AgentIdentityStep } from "./AgentIdentityStep";
import { AgentBehaviorStep } from "./AgentBehaviorStep";
import { AgentKnowledgeStep } from "./AgentKnowledgeStep";
import { AgentOutputStep } from "./AgentOutputStep";
import { AgentStarterPromptsStep } from "./AgentStarterPromptsStep";
import { AgentReviewStep } from "./AgentReviewStep";

export function AgentWizard({ mode }: { mode: "create" | "import" }) {
  const isImport = mode === "import";
  const wiz = useAgentWizard(isImport);
  const { state, steps, stepIndex, goNext, goPrev, goTo, updateDraft, dispatch } = wiz;
  const { step, draft, saving } = state;
  const router = useRouter();
  const { toast } = useToast();

  function canNavigateTo(target: WizardStep): boolean {
    const targetIdx = steps.indexOf(target);
    if (targetIdx <= stepIndex) return true;
    for (let i = 0; i < targetIdx; i++) {
      if (!canProceed(steps[i], draft)) return false;
    }
    return true;
  }

  async function handleSave(publish: boolean) {
    if (publish) {
      const identityErrors = validateIdentity(draft);
      const behaviorErrors = validateBehavior(draft);
      const allErrors = [...identityErrors, ...behaviorErrors];
      if (allErrors.length > 0) {
        toast(`Cannot publish: ${allErrors[0]}`, "error");
        return;
      }
    }

    dispatch({ type: "SET_SAVING", saving: true });
    try {
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        category: draft.category.trim() || null,
        icon: draft.icon,
        teamId: draft.teamId || null,
        scope: draft.scope,
        status: publish ? "PUBLISHED" : "DRAFT",
        systemInstructions: draft.systemInstructions,
        behaviorRules: draft.behaviorRules,
        toneGuidance: draft.toneGuidance,
        avoidRules: draft.avoidRules,
        temperature: draft.temperature,
        maxTokens: draft.maxTokens,
        strictMode: draft.strictMode,
        outputMode: draft.outputMode,
        structuredSections: draft.structuredSections,
        jsonSchema: draft.jsonSchema,
        templateText: draft.templateText,
        markdownRules: draft.markdownRules,
        knowledgeSources: draft.knowledgeSources.map((k) => ({
          type: k.type,
          title: k.title,
          content: k.content,
        })),
        starterPrompts: draft.starterPrompts.map((p) => p.text),
      };

      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      toast(publish ? "Agent published successfully" : "Draft saved successfully");
      router.push(`/admin/agents/${data.agent.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      dispatch({ type: "SET_SAVING", saving: false });
    }
  }

  const stepContent = (() => {
    switch (step) {
      case "import-method":
        return <ImportMethodStep draft={draft} updateDraft={updateDraft} />;
      case "identity":
        return <AgentIdentityStep draft={draft} updateDraft={updateDraft} />;
      case "behavior":
        return <AgentBehaviorStep draft={draft} updateDraft={updateDraft} />;
      case "knowledge":
        return <AgentKnowledgeStep draft={draft} dispatch={dispatch} />;
      case "output":
        return <AgentOutputStep draft={draft} updateDraft={updateDraft} dispatch={dispatch} />;
      case "starter-prompts":
        return <AgentStarterPromptsStep draft={draft} dispatch={dispatch} />;
      case "review":
        return (
          <AgentReviewStep
            draft={draft}
            saving={saving}
            onSaveDraft={() => void handleSave(false)}
            onPublish={() => void handleSave(true)}
            onGoBack={goPrev}
          />
        );
      default:
        return null;
    }
  })();

  const isFirst = stepIndex === 0;
  const isLast = step === "review";

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-6 lg:flex-row">
      {/* Stepper */}
      <aside className="w-full shrink-0 lg:w-56">
        <div className="lg:sticky lg:top-24">
          <WizardStepper
            steps={steps}
            current={step}
            onGo={goTo}
            canNavigate={canNavigateTo}
          />
          {/* Step counter on mobile */}
          <p className="mt-2 text-center text-[11px] text-zinc-400 lg:hidden">
            Step {stepIndex + 1} of {steps.length}
          </p>
        </div>
      </aside>

      {/* Content */}
      <main className="min-w-0 flex-1">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
          {stepContent}
        </div>

        {!isLast ? (
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={goPrev}
              disabled={isFirst}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!wiz.canProceedCurrent}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Continue
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </main>

      {/* Preview — hidden on smaller screens */}
      <aside className="hidden w-80 shrink-0 xl:block">
        <div className="sticky top-24">
          <AgentPreviewPanel step={step} draft={draft} />
        </div>
      </aside>
    </div>
  );
}
