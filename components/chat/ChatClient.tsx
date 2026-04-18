"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { MessageList } from "@/components/chat/MessageList";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { SavedPromptsPanel } from "@/components/chat/SavedPromptsPanel";
import { signIn, useSession } from "next-auth/react";
import { useChatSession } from "@/components/chat/hooks/useChatSession";
import { useChatStream } from "@/components/chat/hooks/useChatStream";
import { useToast } from "@/components/ui/Toast";
import type { UiStarterPrompt } from "@/lib/types";
import {
  chatLastUsedAgentStorageKey,
  resolveChatDefaultAgentId,
} from "@/lib/chatDefaultAgent";

export function ChatClient() {
  const { status, data: session } = useSession();

  const {
    sessions,
    agents,
    agentsLoading,
    agentsError,
    refreshSessions,
    createSession,
    renameSession,
    deleteSession,
    searchSessions,
  } = useChatSession();

  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [activeAgentId, setActiveAgentId] = useState<string>("");
  const [agentSelectionReady, setAgentSelectionReady] = useState(false);
  const initAgentForUserRef = useRef<string | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; text: string } | null>(null);
  const [regenOfId, setRegenOfId] = useState<string | undefined>(undefined);
  const [composerSeedText, setComposerSeedText] = useState<string | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savedPromptsOpen, setSavedPromptsOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("openai-gpt-4o-mini");
  const [authLoadingTimedOut, setAuthLoadingTimedOut] = useState(false);

  const { toast } = useToast();

  const { messages, loading, send, regenerate, cancel, loadMessages } = useChatStream({
    sessionId: activeSessionId,
    agentId: activeAgentId,
    onMessageAdded: refreshSessions,
    modelVersion: selectedModelId,
    onError: (msg) => toast(msg, "error"),
  });

  const activeAgent = useMemo(
    () => agents.find((a) => a.id === activeAgentId),
    [agents, activeAgentId]
  );

  const composerPlaceholder = useMemo(() => {
    if (!activeAgent) return "Ask Assistant...";

    const sortedStarters = [...activeAgent.starterPrompts]
      .filter((starter) => starter.isActive !== false && starter.prompt.trim().length > 0)
      .sort(
        (a: UiStarterPrompt, b: UiStarterPrompt) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
      );
    const topStarter = sortedStarters[0];
    if (topStarter) {
      const sample = topStarter.prompt.replace(/\s+/g, " ").trim();
      const condensed = sample.length > 72 ? `${sample.slice(0, 69)}...` : sample;
      return `${activeAgent.name}: ${condensed}`;
    }

    if (activeAgent.category) {
      return `Ask ${activeAgent.name} (${activeAgent.category})...`;
    }

    return `Ask ${activeAgent.name}...`;
  }, [activeAgent]);

  const attachmentUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const message of messages) {
      for (const url of message.imageUrls ?? []) {
        if (typeof url === "string" && url.length > 0) {
          urls.add(url);
        }
      }
    }
    return Array.from(urls);
  }, [messages]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      initAgentForUserRef.current = null;
      setActiveAgentId("");
      setAgentSelectionReady(false);
      return;
    }

    if (agentsLoading) return;

    const uid = session.user.id;

    if (agentsError) {
      setActiveAgentId("");
      setAgentSelectionReady(true);
      return;
    }

    if (agents.length === 0) {
      setActiveAgentId("");
      setAgentSelectionReady(true);
      return;
    }

    if (initAgentForUserRef.current === uid) return;

    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(chatLastUsedAgentStorageKey(uid))
        : null;
    const workspaceDefaultAgentId = agents.find((a) => a.isDefault)?.id ?? null;

    const resolved = resolveChatDefaultAgentId(agents, {
      lastUsedAgentId: saved,
      workspaceDefaultAgentId,
    });

    setActiveAgentId(resolved);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(chatLastUsedAgentStorageKey(uid), resolved);
    }
    initAgentForUserRef.current = uid;
    setAgentSelectionReady(true);
  }, [status, session?.user?.id, agents, agentsLoading, agentsError]);

  useEffect(() => {
    if (status !== "loading") {
      setAuthLoadingTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setAuthLoadingTimedOut(true), 3500);
    return () => clearTimeout(timer);
  }, [status]);

  const handleSelectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setMobileSidebarOpen(false);
    await loadMessages(sessionId);
  };

  const handleCreateSession = async () => {
    const newSessionId = await createSession();
    if (newSessionId) {
      setActiveSessionId(newSessionId);
      await loadMessages(newSessionId);
    }
  };

  const shareSession = async (sessionId: string) => {
    try {
      const response = await fetch("/api/chat/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await response.json();
      const shareUrl = data.url ?? `${window.location.origin}/chat?sessionId=${sessionId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast("Share link copied to clipboard");
    } catch {
      toast("Failed to generate share link", "error");
    }
  };

  const handleSend = async (text: string, imageFiles?: File[]) => {
    let sid = activeSessionId;
    if (!sid) {
      const newId = await createSession();
      if (!newId) return;
      sid = newId;
      setActiveSessionId(newId);
    }
    await send(text, imageFiles, undefined, editTarget?.id, regenOfId, sid !== activeSessionId ? sid : undefined);
    setEditTarget(null);
    setRegenOfId(undefined);
    setComposerSeedText(undefined);
  };

  const handleAgentChange = (id: string) => {
    if (id === activeAgentId) return;
    if (messages.length > 0) {
      setActiveSessionId(undefined);
    }
    setActiveAgentId(id);
    const uid = session?.user?.id;
    if (uid && typeof window !== "undefined") {
      window.localStorage.setItem(chatLastUsedAgentStorageKey(uid), id);
    }
  };

  if (status === "loading" && !authLoadingTimedOut) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-zinc-500">Loading your session...</p>
        </div>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-gray-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          {authLoadingTimedOut ? (
            <p className="text-sm text-zinc-500">
              Session check is taking longer than expected. You can still continue.
            </p>
          ) : null}
          <button
            onClick={() => signIn("credentials", { email: "demo@example.com", callbackUrl: "/" })}
            className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
          >
            Sign in as demo user
          </button>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-zinc-500 underline hover:text-zinc-700"
          >
            Retry loading
          </button>
        </div>
      </main>
    );
  }

  return (
    <ChatLayout
      sidebar={
        <ChatSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={handleSelectSession}
          onNewChat={handleCreateSession}
          onRename={renameSession}
          onDelete={async (id) => {
            await deleteSession(id);
            if (activeSessionId === id) setActiveSessionId(undefined);
          }}
          onShare={shareSession}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onSearch={async (q) => { await searchSessions(q); }}
        />
      }
      drawerOpen={drawerOpen}
      onToggleDrawer={() => setDrawerOpen((prev) => !prev)}
      savedPromptsOpen={savedPromptsOpen}
      onToggleSavedPrompts={() => setSavedPromptsOpen((prev) => !prev)}
      activeAgentId={activeAgentId}
      activeSessionId={activeSessionId}
      sessions={sessions}
      messageCount={messages.length}
      attachmentUrls={attachmentUrls}
      selectedModelId={selectedModelId}
      agents={agents}
      agentsLoading={agentsLoading || (agentSelectionReady === false && !agentsError)}
      agentsError={agentsError}
      onAgentChange={handleAgentChange}
      mobileSidebarOpen={mobileSidebarOpen}
      onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
    >
      <div className="flex w-full h-full min-h-0 relative">
        <div className="flex flex-1 flex-col h-full min-h-0 relative">
          <MessageList
            messages={messages}
            onRegenerate={regenerate}
            onEdit={(id, text) => {
              setEditTarget({ id, text });
              setComposerSeedText(text);
            }}
            onSuggestionClick={(text) => setComposerSeedText(text)}
            loading={loading}
            activeAgent={activeAgent}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 pb-4">
            <div className="pointer-events-auto px-4">
              <ChatComposer
                onSend={handleSend}
                disabled={loading}
                initialText={composerSeedText}
                activeAgent={activeAgent}
                modeLabel={
                  editTarget
                    ? "Editing a previous prompt. Sending will create a revised turn."
                    : regenOfId
                    ? "Regenerating response from prior context."
                    : undefined
                }
                onCancelMode={() => {
                  setEditTarget(null);
                  setRegenOfId(undefined);
                  setComposerSeedText(undefined);
                }}
                onCancelStream={loading ? cancel : undefined}
                placeholderText={composerPlaceholder}
                selectedModelId={selectedModelId}
                onModelChange={setSelectedModelId}
              />
            </div>
          </div>
        </div>
        {savedPromptsOpen ? (
          <SavedPromptsPanel
            onUse={(text) => setComposerSeedText(text)}
            onClose={() => setSavedPromptsOpen(false)}
          />
        ) : null}
      </div>
    </ChatLayout>
  );
}
