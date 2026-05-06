"use client";

import { Fragment, type RefObject, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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
  /** When set, rows that would fail manual routing for this agent + current draft are disabled. */
  agentModelIncompatible,
}: {
  selectedModelId: string;
  onModelChange: (id: string) => void;
  models: UiModelSummary[];
  loading?: boolean;
  budgetStatus?: "ok" | "warning" | "blocked";
  disabled?: boolean;
  hasImages?: boolean;
  agentHint?: string | null;
  agentModelIncompatible?: (model: UiModelSummary) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [desktopPanelStyle, setDesktopPanelStyle] = useState<{
    left: number;
    bottom: number;
    width: number;
  } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const desktopPanelRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

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
    const agentIncompatible = Boolean(agentModelIncompatible?.(model));
    const isDisabled = !model.enabled || Boolean(imageIncompatible) || agentIncompatible;

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
        className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
          isActive
            ? "bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-950/30 dark:ring-violet-800"
            : isDisabled
            ? "cursor-not-allowed opacity-60"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        }`}
      >
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500/90" />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <span
              className={`min-w-0 max-w-full break-words text-sm font-semibold leading-snug ${
                isActive ? "text-violet-800 dark:text-violet-200" : "text-zinc-800 dark:text-zinc-200"
              }`}
            >
              {model.displayName}
            </span>
            <span className="shrink-0 rounded-full bg-zinc-100/90 px-1.5 py-px text-[9px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {PROVIDER_DISPLAY[model.provider]}
            </span>
            <span className="shrink-0 rounded-full bg-zinc-100/90 px-1.5 py-px text-[9px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {COST_TIER_DISPLAY[model.costTier]}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 min-w-0 break-words text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
            {model.shortDescription}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {model.capabilities.filter((c): c is UiModelCapability => MODEL_CAPABILITY_CHIP_SET.has(c)).map((capability) => (
              <span
                key={`${model.id}-${capability}`}
                className="max-w-full break-words rounded-full bg-zinc-100/85 px-1.5 py-px text-[9px] font-medium text-zinc-600/90 dark:bg-zinc-800 dark:text-zinc-400"
              >
                {MODEL_CAPABILITY_LABELS[capability]}
              </span>
            ))}
          </div>
          {imageIncompatible ? (
            <p className="mt-1 break-words text-[10px] text-amber-700/90 dark:text-amber-400">
              Selected attachments require a Vision-capable model.
            </p>
          ) : null}
          {!imageIncompatible && agentIncompatible ? (
            <p className="mt-1 break-words text-[10px] text-amber-700/90 dark:text-amber-400">
              Not compatible with this assistant for your current message.
            </p>
          ) : null}
          {!imageIncompatible && !agentIncompatible && !model.enabled && model.disabledReason ? (
            <p className="mt-1 break-words text-[10px] text-zinc-500/90 dark:text-zinc-400">{model.disabledReason}</p>
          ) : null}
          {model.healthAdvisory?.status === "recently_rate_limited" ? (
            <p className="mt-1 break-words text-[10px] text-amber-700/90 dark:text-amber-400">
              {model.healthAdvisory.message}
            </p>
          ) : null}
        </div>
      </button>
    );
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        ref.current?.contains(target) ||
        desktopPanelRef.current?.contains(target) ||
        mobilePanelRef.current?.contains(target)
      ) {
        return;
      }
      close();
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

  useEffect(() => {
    if (!open) return;

    const updateDesktopPanelPosition = () => {
      if (!ref.current || typeof window === "undefined") return;
      const triggerRect = ref.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const panelWidth = Math.min(352, Math.max(280, viewportWidth - 24));
      const minLeft = 12;
      const maxLeft = Math.max(minLeft, viewportWidth - panelWidth - 12);
      const left = Math.min(Math.max(triggerRect.right - panelWidth, minLeft), maxLeft);
      const bottom = Math.max(12, window.innerHeight - triggerRect.top + 8);
      setDesktopPanelStyle({ left, bottom, width: panelWidth });
    };

    updateDesktopPanelPosition();
    window.addEventListener("resize", updateDesktopPanelPosition);
    window.addEventListener("scroll", updateDesktopPanelPosition, true);
    return () => {
      window.removeEventListener("resize", updateDesktopPanelPosition);
      window.removeEventListener("scroll", updateDesktopPanelPosition, true);
    };
  }, [open]);

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

  function renderModelList(className: string, panelRef?: RefObject<HTMLDivElement>) {
    return (
      <div
        ref={panelRef}
        role="listbox"
        aria-label="Choose a model"
        className={className}
      >
        <div className="mb-1 px-2 pb-1 pt-1 text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
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
            <div className="mb-1 mt-2 px-2 pb-1 pt-2 text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
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
    );
  }

  const mobileSheet = (
    <div className="md:hidden">
      <button
        type="button"
        className="fixed inset-0 z-[70] bg-black/25"
        onClick={close}
        aria-label="Close model selector"
      />
      {renderModelList(
        "fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-[80] max-h-[min(72dvh,32rem)] w-[calc(100vw-24px)] max-w-[420px] -translate-x-1/2 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-2xl dark:border-zinc-700 dark:bg-zinc-900",
        mobilePanelRef
      )}
    </div>
  );

  const desktopPopover = desktopPanelStyle
    ? renderModelList(
        "h-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.08)] dark:border-zinc-700 dark:bg-zinc-900",
        desktopPanelRef
      )
    : null;

  return (
    <div ref={ref} className="relative flex min-w-0 max-w-full flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        disabled={disabled}
        className="flex max-w-[min(100%,18rem)] items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white/80 py-1.5 pl-2.5 pr-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 focus:outline-none disabled:opacity-50 dark:border-transparent dark:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Model: ${selected.displayName}`}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
        <span className="min-w-0 flex-1 truncate">{selected.displayName}</span>
        <span className="hidden shrink-0 rounded-full bg-zinc-100 px-1.5 py-px text-[10px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 sm:inline">
          {PROVIDER_DISPLAY[selected.provider]}
        </span>
        <span
          className="hidden max-w-[5.5rem] truncate text-[10px] text-zinc-600 dark:text-zinc-400 lg:inline"
          title={capabilityHint}
        >
          {capabilityHint}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {agentHint ? (
        <p className="max-w-[min(100%,15rem)] text-right text-[10px] leading-snug text-zinc-600 dark:text-zinc-500" title={agentHint}>
          {agentHint}
        </p>
      ) : null}

      {open ? (
        <>
          {mounted && desktopPopover && desktopPanelStyle
            ? createPortal(
                <div
                  className="fixed z-[90] hidden md:block"
                  style={{
                    left: desktopPanelStyle.left,
                    bottom: desktopPanelStyle.bottom,
                    width: desktopPanelStyle.width,
                    maxHeight: "min(420px,calc(100vh-160px))",
                  }}
                >
                  {desktopPopover}
                </div>,
                document.body
              )
            : null}
          {mounted ? createPortal(mobileSheet, document.body) : null}
        </>
      ) : null}
    </div>
  );
}
