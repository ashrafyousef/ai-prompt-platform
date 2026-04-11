export async function parseSSEStream(
  response: Response,
  onChunk: (text: string) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
) {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
      
      for (const line of lines) {
        const data = line.replace("data: ", "").trim();
        if (data === "[DONE]" || !data) continue;
        
        try {
          const parsed = JSON.parse(data) as { delta?: string; error?: string };
          if (parsed.error) {
            onError(parsed.error);
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
