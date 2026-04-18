"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown, Loader2, AlertCircle, Search, Check, Star } from "lucide-react";
import type { UiAgent } from "@/lib/types";

function AgentOptionCard({
  agent,
  selected,
  onSelect,
}: {
  agent: UiAgent;
  selected: boolean;
  onSelect: () => void;
}) {
  const roleDescription = agent.description?.trim() || (agent.category ? `${agent.category} assistant` : "General assistant");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        selected
          ? "bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-950/30 dark:ring-violet-800"
          : "hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-800/50 dark:active:bg-zinc-800"
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base transition-colors ${
          selected
            ? "bg-violet-100 dark:bg-violet-900/40"
            : "bg-zinc-100 dark:bg-zinc-800"
        }`}
      >
        {agent.icon || "🤖"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`truncate text-sm font-medium ${selected ? "text-violet-800 dark:text-violet-200" : "text-zinc-900 dark:text-zinc-100"}`}>
            {agent.name}
          </p>
          {selected ? (
            <span className="shrink-0 rounded-full bg-violet-200 px-1.5 py-px text-[9px] font-semibold text-violet-700 dark:bg-violet-800 dark:text-violet-200">
              Active
            </span>
          ) : null}
          {agent.isDefault ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              Default
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
          {roleDescription}
        </p>
      </div>
      {agent.availability ? (
        <span className="mt-1 shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {agent.availability === "GLOBAL" ? "Global" : "Team"}
        </span>
      ) : null}
    </button>
  );
}

export function AgentSelector({
  agents,
  activeAgentId,
  onAgentChange,
  loading,
  error,
}: {
  agents: UiAgent[];
  activeAgentId: string;
  onAgentChange: (id: string) => void;
  loading?: boolean;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const active = agents.find((a) => a.id === activeAgentId);

  const filtered = search.trim()
    ? agents.filter((a) => {
        const q = search.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q) ||
          a.category?.toLowerCase().includes(q)
        );
      })
    : agents;

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      document.addEventListener("keydown", onEsc);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, close]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading agents…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Failed to load agents</span>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
        <span className="text-sm">🤖</span>
        <span>No agents available for your team</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-zinc-300 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
      >
        <span className="text-base leading-none">{active?.icon || "🤖"}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="max-w-[140px] truncate font-medium text-zinc-800 dark:text-zinc-200">
            {active?.name || "Select Agent"}
          </span>
          {active ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : null}
          {active?.isDefault ? <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : null}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:w-80"
        >
          {active ? (
            <div className="mb-1 flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-2 text-xs text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span className="truncate">
                Active: <span className="font-medium text-zinc-700 dark:text-zinc-200">{active.name}</span>
              </span>
            </div>
          ) : null}
          {agents.length > 3 ? (
            <div className="relative mb-1 px-1.5">
              <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents…"
                className="w-full rounded-lg border-0 bg-zinc-50 py-2 pl-8 pr-3 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:bg-zinc-800 dark:text-zinc-200"
              />
            </div>
          ) : null}
          <div className="max-h-72 overflow-auto py-0.5">
            {filtered.length > 0 ? (
              filtered.map((agent) => (
                <AgentOptionCard
                  key={agent.id}
                  agent={agent}
                  selected={agent.id === activeAgentId}
                  onSelect={() => {
                    onAgentChange(agent.id);
                    close();
                  }}
                />
              ))
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {search.trim() ? "No agents match your search." : "No agents available for your team yet."}
                </p>
                <p className="mt-1 text-xs text-zinc-400">Contact your admin to set up agents.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
