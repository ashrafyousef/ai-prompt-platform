import useSWR from "swr";
import { UiSession, UiAgent } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useChatSession() {
  const { data: historyData, mutate: refreshSessions } = useSWR<{ sessions: UiSession[] }>("/api/chat/history", fetcher);
  const { data: agentsData, error: agentsError, isLoading: agentsLoading } = useSWR<{ agents: UiAgent[] }>("/api/agents", fetcher);

  const sessions = historyData?.sessions ?? [];
  const agents = agentsData?.agents ?? [];

  const createSession = async () => {
    const res = await fetch("/api/chat/new", { method: "POST" });
    const data = await res.json();
    if (data.session) {
      await refreshSessions((prev) => ({
        ...prev,
        sessions: [data.session, ...(prev?.sessions || [])]
      }), false);
      return data.session.id;
    }
    return undefined;
  };

  const renameSession = async (sessionId: string, title: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    
    await refreshSessions((prev) => {
      if (!prev) return prev;
      return { 
        ...prev, 
        sessions: prev.sessions.map(s => s.id === sessionId ? { ...s, title: cleanTitle } : s)
      };
    }, false);

    await fetch("/api/chat/title", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, title: cleanTitle }),
    });
    
    await refreshSessions();
  };

  const deleteSession = async (sessionId: string) => {
    await refreshSessions((prev) => {
      if (!prev) return prev;
      return { ...prev, sessions: prev.sessions.filter(s => s.id !== sessionId) };
    }, false);
    
    await fetch(`/api/chat/history?sessionId=${sessionId}`, { method: "DELETE" });
    await refreshSessions();
  };

  const searchSessions = async (query: string) => {
    if (!query.trim()) {
      await refreshSessions();
      return;
    }
    const encoded = encodeURIComponent(query);
    const res = await fetch(`/api/chat/history?search=${encoded}`);
    const data = await res.json();
    await refreshSessions({ sessions: data.sessions ?? [] }, false);
  };

  return {
    sessions,
    agents,
    agentsLoading,
    agentsError: agentsError ? (agentsError instanceof Error ? agentsError.message : String(agentsError)) : null,
    refreshSessions,
    createSession,
    renameSession,
    deleteSession,
    searchSessions
  };
}
