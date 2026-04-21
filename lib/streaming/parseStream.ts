/**
 * Parses our chat route’s SSE (`data: {json}\\n`). Buffers across TCP chunks so lines split
 * mid-packet still parse (fixes empty assistant bubbles when chunks split inside `data:` lines).
 */
export async function parseSSEStream(
  response: Response,
  onChunk: (text: string) => void,
  onError: (error: string) => void,
  signal?: AbortSignal,
  onMeta?: (meta: unknown) => void
) {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let lineBuf = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      lineBuf += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = lineBuf.indexOf("\n")) >= 0) {
        const raw = lineBuf.slice(0, nl);
        lineBuf = lineBuf.slice(nl + 1);
        const line = raw.replace(/\r$/, "").trimEnd();
        if (!line.startsWith("data: ")) continue;

        const data = line.slice(6).trim();
        if (data === "[DONE]" || !data) continue;

        try {
          const parsed = JSON.parse(data) as { delta?: string; error?: string; meta?: unknown };
          if (parsed.error) {
            onError(parsed.error);
          } else if (parsed.meta !== undefined) {
            onMeta?.(parsed.meta);
          } else if (parsed.delta) {
            onChunk(parsed.delta);
          }
        } catch {
          onChunk(data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
