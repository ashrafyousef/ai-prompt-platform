import { ReactNode } from "react";
import { PanelRightClose, PanelRightOpen, Bookmark, Menu } from "lucide-react";
import { UiAgent } from "@/lib/types";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function ChatLayout({
  sidebar,
  drawerOpen,
  onToggleDrawer,
  savedPromptsOpen,
  onToggleSavedPrompts,
  activeAgentName,
  activeAgentId,
  agents,
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
  activeAgentName: string;
  activeAgentId: string;
  agents: UiAgent[];
  onAgentChange: (id: string) => void;
  mobileSidebarOpen: boolean;
  onToggleMobileSidebar: () => void;
  children: ReactNode;
}) {
  return (
    <main className="flex h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 text-zinc-900 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      <div className="hidden md:block">{sidebar}</div>

      {mobileSidebarOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={onToggleMobileSidebar}
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            {sidebar}
          </div>
        </>
      ) : null}

      <section className="relative flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200/70 bg-white/80 px-4 py-3 text-sm font-medium text-zinc-900 backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/70 dark:text-zinc-100">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-2 text-zinc-600 hover:bg-zinc-200 md:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={onToggleMobileSidebar}
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="hidden sm:inline text-xs uppercase tracking-wide text-zinc-500">Agent</span>
            <span className="hidden sm:inline">{activeAgentName}</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              value={activeAgentId}
              onChange={(e) => onAgentChange(e.target.value)}
              aria-label="Select agent"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
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
            <aside className="hidden w-72 border-l border-zinc-200/70 bg-white/70 p-4 text-xs text-zinc-600 backdrop-blur lg:block dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300">
              <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Context Drawer</h3>
              <p>Use this space for prompt settings, retrieval context, and metadata.</p>
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}
