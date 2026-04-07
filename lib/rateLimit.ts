const requestStore = new Map<string, number[]>();

export function checkRateLimit(userId: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const history = requestStore.get(userId) ?? [];
  const valid = history.filter((ts) => now - ts < windowMs);
  if (valid.length >= limit) return false;
  valid.push(now);
  requestStore.set(userId, valid);
  return true;
}
