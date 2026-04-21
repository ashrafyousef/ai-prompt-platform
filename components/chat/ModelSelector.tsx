"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { UiModelCapability, UiModelSummary } from "@/lib/types";
import {
  COST_TIER_DISPLAY,
  MODEL_CAPABILITY_CHIP_SET,
  MODEL_CAPABILITY_LABELS,
  PROVIDER_DISPLAY,
} from "@/lib/modelUiLabels";

export function ModelSelector({
  selectedModelId,
  onModelChange,
  models,
  loading,
  budgetStatus,
  disabled,
  hasImages,
  /** Compact agent-specific model expectations; keep short — shown under the control. */
  agentHint,
}: {
  selectedModelId: string;
  onModelChange: (id: string) => void;
  models: UiModelSummary[];
  loading?: boolean;
  budgetStatus?: "ok" | "warning" | "blocked";
  disabled?: boolean;
  hasImages?: boolean;
  agentHint?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = models.find((m) => m.id === selectedModelId);

  const { curatedModels, moreModels } = useMemo(() => {
    const curated: UiModelSummary[] = [];
    const more: UiModelSummary[] = [];
    for (const m of models) {
      if (m.listSection === "more") more.push(m);
      else curated.push(m);
    }
    return { curatedModels: curated, moreModels: more };
  }, [models]);

  const close = useCallback(() => setOpen(false), []);

  function renderModelRow(model: UiModelSummary) {
    const isActive = model.id === selectedModelId;
    const imageIncompatible = hasImages && !model.visionCapable;
    const isDisabled = !model.enabled || Boolean(imageIncompatible);

    return (
      <button
        type="button"
        role="option"
        aria-selected={isActive}
        onClick={() => {
          onModelChange(model.id);
          close();
        }}
        disabled={isDisabled}
        className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
          isActive
            ? "bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-950/30 dark:ring-violet-800"
            : isDisabled
            ? "cursor-not-allowed opacity-40"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        }`}
      >
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`text-sm font-medium ${
                isActive ? "text-violet-800 dark:text-violet-200" : "text-zinc-800 dark:text-zinc-200"
              }`}
            >
              {model.displayName}
            </span>
            <span className="rounded-full bg-zinc-100 px-1.5 py-px text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {PROVIDER_DISPLAY[model.provider]}
            </span>
            <span className="rounded-full bg-zinc-100 px-1.5 py-px text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {COST_TIER_DISPLAY[model.costTier]}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{model.shortDescription}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {model.capabilities.filter((c): c is UiModelCapability => MODEL_CAPABILITY_CHIP_SET.has(c)).map((capability) => (
              <span
                key={`${model.id}-${capability}`}
                className="rounded-full bg-zinc-100 px-1.5 py-px text-[9px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              >
                {MODEL_CAPABILITY_LABELS[capability]}
              </span>
            ))}
          </div>
          {imageIncompatible ? (
            <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">
              Selected attachments require a Vision-capable model.
            </p>
          ) : null}
          {!imageIncompatible && !model.enabled && model.disabledReason ? (
            <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">{model.disabledReason}</p>
          ) : null}
          {model.healthAdvisory?.status === "recently_rate_limited" ? (
            <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">
              {model.healthAdvisory.message}
            </p>
          ) : null}
        </div>
      </button>
    );
  }

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (loading || !models.length || !selected) {
    return (
      <div className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-zinc-400">
        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
        <span className="text-xs">Loading…</span>
      </div>
    );
  }

  const capabilityHint = selected.capabilities
    .filter((c): c is UiModelCapability => MODEL_CAPABILITY_CHIP_SET.has(c))
    .slice(0, 2)
    .map((capability) => MODEL_CAPABILITY_LABELS[capability])
    .join(" · ");

  return (
    <div ref={ref} className="relative flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        disabled={disabled}
        className="flex max-w-[min(100%,18rem)] items-center gap-1.5 rounded-full bg-transparent py-2 pl-3 pr-2 text-left text-sm font-medium text-zinc-600 transition hover:bg-zinc-200 focus:outline-none disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Model: ${selected.displayName}`}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
        <span className="min-w-0 flex-1 truncate">{selected.displayName}</span>
        <span className="hidden shrink-0 rounded-full bg-zinc-200/80 px-1.5 py-px text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 sm:inline">
          {PROVIDER_DISPLAY[selected.provider]}
        </span>
        <span
          className="hidden max-w-[5.5rem] truncate text-[10px] text-zinc-500 dark:text-zinc-400 lg:inline"
          title={capabilityHint}
        >
          {capabilityHint}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {agentHint ? (
        <p className="max-w-[min(100%,15rem)] text-right text-[10px] leading-snug text-zinc-500 dark:text-zinc-500" title={agentHint}>
          {agentHint}
        </p>
      ) : null}

      {open ? (
        <div
          role="listbox"
          aria-label="Choose a model"
          className="absolute bottom-full right-0 z-50 mb-2 max-h-[min(70vh,28rem)] w-[min(100vw-1.5rem,22rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="mb-1 px-2 pb-1 pt-1 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Curated models
          </div>
          {budgetStatus === "warning" ? (
            <div className="mb-1 rounded-lg bg-amber-100/70 px-2.5 py-2 text-[11px] text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              Near your soft monthly limit — medium and high tier models are disabled until usage falls below the threshold.
            </div>
          ) : null}
          {budgetStatus === "blocked" ? (
            <div className="mb-1 rounded-lg bg-red-100/70 px-2.5 py-2 text-[11px] text-red-900 dark:bg-red-900/30 dark:text-red-200">
              Monthly hard limit reached — models are unavailable until the next billing cycle or an admin updates limits.
            </div>
          ) : null}
          <div className="space-y-0.5">
            {curatedModels.map((model) => (
              <Fragment key={model.id}>{renderModelRow(model)}</Fragment>
            ))}
          </div>
          {moreModels.length > 0 ? (
            <>
              <div className="mb-1 mt-2 px-2 pb-1 pt-2 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                More models
              </div>
              <div className="space-y-0.5">
                {moreModels.map((model) => (
                  <Fragment key={model.id}>{renderModelRow(model)}</Fragment>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
