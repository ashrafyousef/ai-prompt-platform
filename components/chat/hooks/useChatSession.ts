import useSWR from "swr";
import { useSession } from "next-auth/react";
import { UiSession, UiAgent } from "@/lib/types";

type ApiError = Error & { status?: number };

async function chatApiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error ?? "").trim()
        : "";
    const err = new Error(message || `Request failed (${res.status})`) as ApiError;
    err.status = res.status;
    throw err;
  }

  return data as T;
}

function shouldRetryChatRequest(error: unknown): boolean {
  const status = (error as ApiError).status;
  return status !== 401 && status !== 403;
}

export function useChatSession() {
  const { status: authStatus } = useSession();
  const chatApisReady = authStatus === "authenticated";

  const {
    data: historyData,
    error: historyError,
    mutate: refreshSessions,
  } = useSWR<{ sessions: UiSession[] }>(
    chatApisReady ? "/api/chat/history" : null,
    chatApiFetcher,
    {
      shouldRetryOnError: shouldRetryChatRequest,
      revalidateOnFocus: chatApisReady,
    }
  );

  const {
    data: agentsData,
    error: agentsError,
    isLoading: agentsLoading,
  } = useSWR<{ agents: UiAgent[] }>(
    chatApisReady ? "/api/agents" : null,
    chatApiFetcher,
    {
      shouldRetryOnError: shouldRetryChatRequest,
      revalidateOnFocus: chatApisReady,
    }
  );

  const sessions = historyData?.sessions ?? [];
  const agents = agentsData?.agents ?? [];

  const createSession = async () => {
    const res = await fetch("/api/chat/new", {
      method: "POST",
      credentials: "same-origin",
    });
    let data: { session?: UiSession; error?: string } = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const message = data.error?.trim() || `Couldn't create chat session (${res.status})`;
      const err = new Error(message) as ApiError;
      err.status = res.status;
      throw err;
    }

    if (!data.session) {
      throw new Error("Chat session was not created.");
    }

    await refreshSessions(
      (prev) => ({
        ...prev,
        sessions: [data.session!, ...(prev?.sessions || [])],
      }),
      false
    );
    return data.session.id;
  };

  const renameSession = async (sessionId: string, title: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    await refreshSessions((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === sessionId ? { ...s, title: cleanTitle } : s
        ),
      };
    }, false);

    await fetch("/api/chat/title", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ sessionId, title: cleanTitle }),
    });

    await refreshSessions();
  };

  const deleteSession = async (sessionId: string) => {
    await refreshSessions((prev) => {
      if (!prev) return prev;
      return { ...prev, sessions: prev.sessions.filter((s) => s.id !== sessionId) };
    }, false);

    await fetch(`/api/chat/history?sessionId=${sessionId}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    await refreshSessions();
  };

  const searchSessions = async (query: string) => {
    if (!query.trim()) {
      await refreshSessions();
      return;
    }
    const encoded = encodeURIComponent(query);
    const data = await chatApiFetcher<{ sessions: UiSession[] }>(
      `/api/chat/history?search=${encoded}`
    );
    await refreshSessions({ sessions: data.sessions ?? [] }, false);
  };

  return {
    sessions,
    agents,
    agentsLoading: authStatus === "loading" || agentsLoading,
    agentsError: agentsError
      ? agentsError instanceof Error
        ? agentsError.message
        : String(agentsError)
      : null,
    historyError: historyError
      ? historyError instanceof Error
        ? historyError.message
        : String(historyError)
      : null,
    historyErrorStatus:
      historyError && typeof historyError === "object" && "status" in historyError
        ? (historyError as ApiError).status
        : undefined,
    refreshSessions,
    createSession,
    renameSession,
    deleteSession,
    searchSessions,
  };
}
