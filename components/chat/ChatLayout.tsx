import { ReactNode, useMemo } from "react";
import { PanelRightClose, PanelRightOpen, Bookmark, Menu, X } from "lucide-react";
import { UiAgent, UiSession } from "@/lib/types";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AgentSelector } from "@/components/chat/AgentSelector";
import { AgentContextDrawer } from "@/components/chat/AgentContextDrawer";

export function ChatLayout({
  sidebar,
  drawerOpen,
  onToggleDrawer,
  savedPromptsOpen,
  onToggleSavedPrompts,
  activeAgentId,
  activeSessionId,
  sessions,
  messageCount,
  attachmentUrls,
  selectedModelId,
  agents,
  agentsLoading,
  agentsError,
  onAgentChange,
  mobileSidebarOpen,
  onToggleMobileSidebar,
  children
}: {
  sidebar: ReactNode;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  savedPromptsOpen: boolean;
  onToggleSavedPrompts: () => void;
  activeAgentId: string;
  activeSessionId?: string;
  sessions: UiSession[];
  messageCount: number;
  attachmentUrls: string[];
  selectedModelId: string;
  agents: UiAgent[];
  agentsLoading?: boolean;
  agentsError?: string | null;
  onAgentChange: (id: string) => void;
  mobileSidebarOpen: boolean;
  onToggleMobileSidebar: () => void;
  children: ReactNode;
}) {
  const activeAgent = useMemo(
    () => agents.find((a) => a.id === activeAgentId),
    [agents, activeAgentId]
  );
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  return (
    <main className="flex h-[100dvh] overflow-hidden bg-gradient-to-b from-zinc-50 to-zinc-100 text-zinc-900 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      <div className="hidden md:block">{sidebar}</div>

      {mobileSidebarOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={onToggleMobileSidebar}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[min(100vw,360px)] max-w-full overflow-hidden md:hidden [&>aside]:w-full">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-md bg-zinc-100 p-2 text-zinc-600 shadow-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              onClick={onToggleMobileSidebar}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </div>
        </>
      ) : null}

      <section className="relative flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200/70 bg-white/80 px-4 py-2.5 backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-2 text-zinc-600 hover:bg-zinc-200 md:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={onToggleMobileSidebar}
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <AgentSelector
              agents={agents}
              activeAgentId={activeAgentId}
              onAgentChange={onAgentChange}
              loading={agentsLoading}
              error={agentsError}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <button
              className={`rounded-md p-2 transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
                savedPromptsOpen ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-300"
              }`}
              onClick={onToggleSavedPrompts}
              aria-label="Toggle saved prompts"
              title="Saved Prompts"
            >
              <Bookmark className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-2 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              onClick={onToggleDrawer}
              aria-label="Toggle context drawer"
            >
              {drawerOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          {children}
          {drawerOpen ? (
            <aside className="hidden w-72 shrink-0 border-l border-zinc-200/70 bg-white/70 text-xs text-zinc-600 backdrop-blur lg:block dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300">
              <AgentContextDrawer
                agent={activeAgent}
                session={activeSession}
                messageCount={messageCount}
                attachmentUrls={attachmentUrls}
                selectedModelId={selectedModelId}
              />
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}
