import { useRef, useState } from "react";
import { UiMessage } from "@/lib/types";
import { parseSSEStream } from "@/lib/streaming/parseStream";

export function useChatStream({ sessionId, agentId, onMessageAdded, modelVersion, onError }: { sessionId?: string; agentId: string; onMessageAdded?: () => void; modelVersion?: string; onError?: (message: string) => void; }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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

  const loadMessages = async (id: string, customFetch?: boolean) => {
    if (!customFetch && id === sessionId) return;
    const res = await fetch(`/api/chat/history?sessionId=${id}`);
    const data = await res.json();
    setMessages(data.messages ?? []);
  };

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
    setLoading(true);
    
    const userMsgOptimisticId = `usr-${Date.now()}`;
    const assistantMsgOptimisticId = `tmp-${Date.now()}`;
    
    const imageUrls = overrideImageUrls ?? (await uploadImages(imageFiles));
    
    // Only conditionally append optimistic user message if it's not a direct regenerate
    // but typically it's fine. For a perfect optimistic UI we should check.
    // For now we'll stick to mostly tracking the assistant response optimism.
    if (!regenOfId || text) {
      setMessages((prev) => [
        ...prev, 
        ...(text ? [{ id: userMsgOptimisticId, role: "user" as const, content: text, imageUrls, createdAt: new Date().toISOString() }] : []),
        { id: assistantMsgOptimisticId, role: "assistant" as const, content: "", createdAt: new Date().toISOString() }
      ]);
    } else {
      setMessages((prev) => [
        ...prev, 
        { id: assistantMsgOptimisticId, role: "assistant" as const, content: "", createdAt: new Date().toISOString() }
      ]);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: effectiveSessionId, agentId, text, imageUrls, editedFromId, regenOfId, modelVersion
        }),
        signal: controller.signal,
      });

      if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const errorData = await res.json();
        const errorMsg = res.status === 429
          ? "Rate limit exceeded. Please wait a moment and try again."
          : errorData.error || "Something went wrong. Please try again.";
        onError?.(errorMsg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgOptimisticId && m.id !== userMsgOptimisticId));
        return;
      }

      let currentOutput = "";
      await parseSSEStream(
        res,
        (chunk) => {
          currentOutput += chunk;
          setMessages((prev) => 
            prev.map((m) => m.id === assistantMsgOptimisticId ? { ...m, content: currentOutput } : m)
          );
        },
        (errMsg) => {
          const friendlyMsg = errMsg === "Internal server error"
            ? "An error occurred while generating the response."
            : errMsg;
          onError?.(friendlyMsg);
        },
        controller.signal
      );
      
      await loadMessages(effectiveSessionId, true);
      onMessageAdded?.();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        await loadMessages(effectiveSessionId, true);
        onMessageAdded?.();
      } else {
        console.error(e);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };
  
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
    cancel,
    loadMessages,
    setMessages
  };
}
