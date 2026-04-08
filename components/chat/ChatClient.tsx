"use client";

import { useEffect, useMemo, useState } from "react";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { MessageList } from "@/components/chat/MessageList";
import { UiAgent, UiMessage, UiSession } from "@/lib/types";
import { signIn, useSession } from "next-auth/react";

export function ChatClient() {
  const { status } = useSession();
  const [sessions, setSessions] = useState<UiSession[]>([]);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [agents, setAgents] = useState<UiAgent[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [activeAgentId, setActiveAgentId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<{ id: string; text: string } | null>(null);
  const [regenOfId, setRegenOfId] = useState<string | undefined>(undefined);
  const [composerSeedText, setComposerSeedText] = useState<string | undefined>(undefined);

  const activeAgentName = useMemo(
    () => agents.find((a) => a.id === activeAgentId)?.name ?? "No Agent",
    [agents, activeAgentId]
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    void bootstrap();
  }, [status]);

  async function bootstrap() {
    const [historyRes, agentsRes] = await Promise.all([
      fetch("/api/chat/history"),
      fetch("/api/agents"),
    ]);
    const historyData = await historyRes.json();
    const agentData = await agentsRes.json();
    setSessions(historyData.sessions ?? []);
    setAgents(agentData.agents ?? []);
    if (agentData.agents?.length) setActiveAgentId(agentData.agents[0].id);
  }

  async function refreshSessions() {
    const historyRes = await fetch("/api/chat/history");
    const historyData = await historyRes.json();
    setSessions(historyData.sessions ?? []);
  }

  async function loadMessages(sessionId: string) {
    setActiveSessionId(sessionId);
    const res = await fetch(`/api/chat/history?sessionId=${sessionId}`);
    const data = await res.json();
    setMessages(data.messages ?? []);
  }

  async function createSession() {
    const res = await fetch("/api/chat/new", { method: "POST" });
    const data = await res.json();
    if (data.session?.id) {
      setSessions((prev) => [data.session, ...prev]);
      await loadMessages(data.session.id);
    }
  }

  async function renameSession(sessionId: string, title: string) {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId ? { ...session, title: cleanTitle } : session
      )
    );

    await fetch("/api/chat/title", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, title: cleanTitle }),
    });

    await refreshSessions();
  }

  async function uploadImages(files?: File[]): Promise<string[] | undefined> {
    if (!files || files.length === 0) return undefined;
    const urls: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("image", file);
      const uploadRes = await fetch("/api/upload/image", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (uploadData.url) urls.push(uploadData.url);
    }
    return urls.length > 0 ? urls : undefined;
  }

  async function send(text: string, imageFiles?: File[], overrideImageUrls?: string[]) {
    if (!activeSessionId || !activeAgentId) return;
    setLoading(true);
    const imageUrls = overrideImageUrls ?? (await uploadImages(imageFiles));
    const optimisticId = `tmp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, role: "assistant", content: "", createdAt: new Date().toISOString() }]);

    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: activeSessionId,
        agentId: activeAgentId,
        text,
        imageUrls,
        editedFromId: editTarget?.id,
        regenOfId,
      }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let output = "";
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
      for (const line of lines) {
        const data = line.replace("data: ", "");
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as { delta?: string; error?: string };
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.delta) {
            output += parsed.delta;
          }
        } catch {
          output += data;
        }
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...m, content: output } : m))
      );
    }
    setLoading(false);
    setEditTarget(null);
    setRegenOfId(undefined);
    setComposerSeedText(undefined);
    if (activeSessionId) await loadMessages(activeSessionId);
    await refreshSessions();
  }

  async function regenerateFromAssistant(assistantMessageId: string) {
    const assistantIndex = messages.findIndex(
      (message) => message.id === assistantMessageId && message.role === "assistant"
    );
    if (assistantIndex <= 0) return;
    for (let i = assistantIndex - 1; i >= 0; i -= 1) {
      const candidate = messages[i];
      if (candidate.role === "user") {
        setRegenOfId(assistantMessageId);
        await send(candidate.content, undefined, candidate.imageUrls);
        return;
      }
    }
  }

  async function deleteSession(sessionId: string) {
    await fetch(`/api/chat/history?sessionId=${sessionId}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((session) => session.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(undefined);
      setMessages([]);
    }
  }

  async function shareSession(sessionId: string) {
    const shareUrl = `${window.location.origin}/chat?sessionId=${sessionId}`;
    await navigator.clipboard.writeText(shareUrl);
  }

  if (status === "loading") return <main className="bg-white p-6 text-gray-900">Loading...</main>;
  if (status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-gray-900">
        <button
          onClick={() => signIn("credentials", { email: "demo@example.com", callbackUrl: "/" })}
          className="rounded-md bg-black px-4 py-2 text-white"
        >
          Sign in as demo user
        </button>
      </main>
    );
  }

  return (
    <main className="flex h-screen bg-white text-gray-900">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={loadMessages}
        onNewChat={createSession}
        onRename={renameSession}
        onDelete={deleteSession}
        onShare={shareSession}
      />
      <section className="flex flex-1 flex-col bg-white">
        <div className="border-b border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900">
          Agent: {activeAgentName}
          <select
            className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
            value={activeAgentId}
            onChange={(e) => setActiveAgentId(e.target.value)}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
        <MessageList
          messages={messages}
          onRegenerate={(messageId) => void regenerateFromAssistant(messageId)}
          onEdit={(messageId, currentText) => {
            setEditTarget({ id: messageId, text: currentText });
            setComposerSeedText(currentText);
          }}
        />
        <ChatComposer
          onSend={send}
          disabled={loading || !activeSessionId}
          initialText={composerSeedText}
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
        />
      </section>
    </main>
  );
}
