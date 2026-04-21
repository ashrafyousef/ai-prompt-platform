import { useCallback, useRef, useState } from "react";
import type { UiGenerationState, UiMessage } from "@/lib/types";
import { parseSSEStream } from "@/lib/streaming/parseStream";
import { classifyChatError } from "@/lib/chatErrorTaxonomy";

export type ChatRouteMeta = {
  assistantMessageId?: string;
  turnId?: string;
  routedModelId?: string;
  routerMode?: string;
  reasonCodes?: string[];
  suggestedModelId?: string | null;
  taskClass?: string;
};

/** Secondary toast when the thread already shows full failure copy. */
export type ChatStreamErrorOptions = {
  /** When true, ChatClient should use a short ping instead of duplicating the error body. */
  detailShownInThread?: boolean;
};

export function useChatStream({
  sessionId,
  agentId,
  onMessageAdded,
  modelVersion,
  modelRoutingMode = "manual",
  onError,
}: {
  sessionId?: string;
  agentId: string;
  onMessageAdded?: () => void;
  modelVersion?: string;
  modelRoutingMode?: "manual" | "auto" | "suggested";
  onError?: (message: string, options?: ChatStreamErrorOptions) => void;
}) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRouteMeta, setLastRouteMeta] = useState<ChatRouteMeta | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Prevents double-submit / accidental repeat while a turn is in flight. */
  const sendCooldownUntilRef = useRef(0);

  const compressImage = async (file: File): Promise<File> => {
    if (file.size < 3 * 1024 * 1024) return file;
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const max = 1200;
        if (width > height && width > max) {
          height *= max / width;
          width = max;
        } else if (height > max) {
          width *= max / height;
          height = max;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], file.name, { type: "image/jpeg" }));
          else resolve(file);
        }, "image/jpeg", 0.7);
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  };

  const uploadImages = async (files?: File[]) => {
    if (!files || files.length === 0) return undefined;
    const urls: string[] = [];
    for (const file of files) {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("image", compressed);
      const res = await fetch("/api/upload/image", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) urls.push(data.url);
    }
    return urls.length > 0 ? urls : undefined;
  };

  const loadMessages = useCallback(async (id: string, customFetch?: boolean) => {
    if (!customFetch && id === sessionId) return;
    const res = await fetch(`/api/chat/history?sessionId=${id}`);
    const data = await res.json();
    const list = (data.messages ?? []) as Array<
      UiMessage & {
        deliveryStatus?: "PENDING" | "STREAMING" | "FAILED" | "COMPLETED" | "CANCELLED";
        errorCode?: string | null;
        errorMessage?: string | null;
      }
    >;
    setMessages(
      list.map((m) => ({
        ...m,
        generation:
          m.role !== "assistant"
            ? undefined
            : m.deliveryStatus === "FAILED"
            ? (() => {
                const classified = classifyChatError(m.errorMessage ?? m.content);
                return {
                  status: "failed",
                  code: m.errorCode ?? classified.code,
                  title: classified.title,
                  detail: m.errorMessage ?? classified.detail,
                } satisfies UiGenerationState;
              })()
            : m.deliveryStatus === "STREAMING"
            ? ({ status: "streaming" } satisfies UiGenerationState)
            : ({ status: "complete" } satisfies UiGenerationState),
      }))
    );
  }, [sessionId]);

  const markAssistantFailed = useCallback(
    (assistantId: string, rawError: string, partialContent: string) => {
      const classified = classifyChatError(rawError);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m;
          const gen: UiGenerationState = {
            status: "failed",
            code: classified.code,
            title: classified.title,
            detail: classified.detail,
          };
          return {
            ...m,
            content: partialContent.trim().length > 0 ? partialContent : "",
            generation: gen,
          };
        })
      );
      onError?.(classified.detail, { detailShownInThread: true });
    },
    [onError]
  );

  const send = async (
    text: string,
    imageFiles?: File[],
    overrideImageUrls?: string[],
    editedFromId?: string,
    regenOfId?: string,
    sessionOverride?: string
  ) => {
    const effectiveSessionId = sessionOverride || sessionId;
    if (!effectiveSessionId || !agentId) return;

    if (Date.now() < sendCooldownUntilRef.current) return;
    if (loading) return;

    setLoading(true);

    const userMsgOptimisticId = `usr-${Date.now()}`;
    const assistantMsgOptimisticId = `tmp-${Date.now()}`;
    const imageUrls = overrideImageUrls ?? (await uploadImages(imageFiles));

    const isRegenerate = Boolean(regenOfId);
    let turnId = crypto.randomUUID();

    if (isRegenerate && !messages.some((m) => m.id === regenOfId)) {
      setLoading(false);
      return;
    }

    if (isRegenerate) {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === regenOfId);
        if (idx < 0) return prev;
        let userTurnId = "";
        for (let i = idx - 1; i >= 0; i--) {
          if (prev[i].role === "user") {
            userTurnId = prev[i].turnId ?? prev[i].id;
            break;
          }
        }
        turnId = userTurnId || crypto.randomUUID();
        const streaming: UiGenerationState = { status: "streaming" };
        return prev.map((m) =>
          m.id === regenOfId
            ? {
                ...m,
                id: assistantMsgOptimisticId,
                content: "",
                turnId,
                generation: streaming,
                createdAt: new Date().toISOString(),
              }
            : m
        );
      });
    } else {
      setMessages((prev) => [
        ...prev,
        ...(text
          ? [
              {
                id: userMsgOptimisticId,
                role: "user" as const,
                turnId,
                content: text,
                imageUrls,
                createdAt: new Date().toISOString(),
              },
            ]
          : []),
        {
          id: assistantMsgOptimisticId,
          role: "assistant" as const,
          turnId,
          content: "",
          createdAt: new Date().toISOString(),
          generation: { status: "streaming" },
        },
      ]);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLastRouteMeta(null);
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: effectiveSessionId,
          agentId,
          text,
          imageUrls,
          editedFromId,
          regenOfId,
          turnId,
          modelVersion,
          modelRoutingMode,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errorMsg = "Something went wrong. Please try again.";
        const ct = res.headers.get("content-type") ?? "";
        try {
          if (ct.includes("application/json")) {
            const errorData = (await res.json()) as { error?: string };
            errorMsg =
              res.status === 429
                ? "Rate limit exceeded. Please wait a moment and try again."
                : errorData.error || errorMsg;
          } else {
            const t = (await res.text()).trim();
            errorMsg = t ? t.slice(0, 400) : `Request failed (${res.status}).`;
          }
        } catch {
          errorMsg = `Request failed (${res.status}).`;
        }
        markAssistantFailed(assistantMsgOptimisticId, errorMsg, "");
        return;
      }

      let currentOutput = "";
      await parseSSEStream(
        res,
        (chunk) => {
          currentOutput += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgOptimisticId
                ? {
                    ...m,
                    content: currentOutput,
                    generation: { status: "streaming" },
                  }
                : m
            )
          );
        },
        (errMsg) => {
          const friendlyMsg =
            errMsg === "Internal server error"
              ? "An error occurred while generating the response."
              : errMsg;
          markAssistantFailed(assistantMsgOptimisticId, friendlyMsg, currentOutput);
        },
        controller.signal,
        (meta) => {
          if (!meta || typeof meta !== "object") return;
          const typed = meta as ChatRouteMeta;
          setLastRouteMeta(typed);
          const persistedAssistantId = typed.assistantMessageId;
          if (persistedAssistantId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgOptimisticId
                  ? { ...m, id: persistedAssistantId, turnId: typed.turnId ?? m.turnId }
                  : m
              )
            );
          }
        }
      );

      await loadMessages(effectiveSessionId, true);
      onMessageAdded?.();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        await loadMessages(effectiveSessionId, true);
        onMessageAdded?.();
      } else {
        console.error(e);
        markAssistantFailed(
          assistantMsgOptimisticId,
          e instanceof Error ? e.message : "Request failed.",
          ""
        );
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
      sendCooldownUntilRef.current = Date.now() + 400;
    }
  };

  /** Retry a failed turn: same user bubble, new assistant attempt linked in DB lineage. */
  const retryTurn = useCallback(
    async (turnId: string) => {
      if (!sessionId || !agentId || loading) return;
      if (Date.now() < sendCooldownUntilRef.current) return;
      const user = messages.find((m) => m.role === "user" && m.turnId === turnId);
      const failedAsst = messages.find(
        (m) =>
          m.role === "assistant" &&
          m.turnId === turnId &&
          m.generation?.status === "failed"
      );
      if (!user || !failedAsst) return;

      const newAssistantId = `tmp-${Date.now()}`;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedAsst.id
            ? {
                ...m,
                id: newAssistantId,
                content: "",
                generation: { status: "streaming" },
                createdAt: new Date().toISOString(),
              }
            : m
        )
      );

      setLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setLastRouteMeta(null);
        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            agentId,
            text: user.content,
            imageUrls: user.imageUrls,
            editedFromId: undefined,
            regenOfId: undefined,
            turnId,
            retryOfAssistantMessageId: failedAsst.id,
            modelVersion,
            modelRoutingMode,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let errorMsg = "Something went wrong. Please try again.";
          const ct = res.headers.get("content-type") ?? "";
          try {
            if (ct.includes("application/json")) {
              const errorData = (await res.json()) as { error?: string };
              errorMsg =
                res.status === 429
                  ? "Rate limit exceeded. Please wait a moment and try again."
                  : errorData.error || errorMsg;
            } else {
              const t = (await res.text()).trim();
              errorMsg = t ? t.slice(0, 400) : `Request failed (${res.status}).`;
            }
          } catch {
            errorMsg = `Request failed (${res.status}).`;
          }
          markAssistantFailed(newAssistantId, errorMsg, "");
          return;
        }

        let currentOutput = "";
        await parseSSEStream(
          res,
          (chunk) => {
            currentOutput += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === newAssistantId
                  ? { ...m, content: currentOutput, generation: { status: "streaming" } }
                  : m
              )
            );
          },
          (errMsg) => {
            const friendlyMsg =
              errMsg === "Internal server error"
                ? "An error occurred while generating the response."
                : errMsg;
            markAssistantFailed(newAssistantId, friendlyMsg, currentOutput);
          },
          controller.signal,
          (meta) => {
            if (!meta || typeof meta !== "object") return;
            const typed = meta as ChatRouteMeta;
            setLastRouteMeta(typed);
            const persistedAssistantId = typed.assistantMessageId;
            if (persistedAssistantId) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === newAssistantId
                    ? { ...m, id: persistedAssistantId, turnId: typed.turnId ?? m.turnId }
                    : m
                )
              );
            }
          }
        );

        await loadMessages(sessionId, true);
        onMessageAdded?.();
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          await loadMessages(sessionId, true);
          onMessageAdded?.();
        } else {
          console.error(e);
          markAssistantFailed(
            newAssistantId,
            e instanceof Error ? e.message : "Request failed.",
            ""
          );
        }
      } finally {
        abortRef.current = null;
        setLoading(false);
        sendCooldownUntilRef.current = Date.now() + 400;
      }
    },
    [
      sessionId,
      agentId,
      loading,
      messages,
      modelVersion,
      modelRoutingMode,
      markAssistantFailed,
      loadMessages,
      onMessageAdded,
    ]
  );

  const regenerate = async (assistantMessageId: string) => {
    const assistantIndex = messages.findIndex(
      (m) => m.id === assistantMessageId && m.role === "assistant"
    );
    if (assistantIndex <= 0) return;
    for (let i = assistantIndex - 1; i >= 0; i--) {
      const candidate = messages[i];
      if (candidate.role === "user") {
        await send(candidate.content, undefined, candidate.imageUrls, undefined, assistantMessageId);
        return;
      }
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
  };

  return {
    messages,
    loading,
    send,
    regenerate,
    retryTurn,
    cancel,
    loadMessages,
    setMessages,
    lastRouteMeta,
  };
}
