import { Redis } from "@upstash/redis";

type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

const requestStore = new Map<string, number[]>();

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function checkRateLimitMemory(
  key: string,
  limit = 20,
  windowMs = 60_000
): Promise<RateLimitResult> {
  const now = Date.now();
  const history = requestStore.get(key) ?? [];
  const valid = history.filter((ts) => now - ts < windowMs);
  if (valid.length >= limit) {
    const oldest = valid[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { allowed: false, retryAfterSec };
  }
  valid.push(now);
  requestStore.set(key, valid);
  return { allowed: true, retryAfterSec: 0 };
}

export async function checkRateLimit(params: {
  userId: string;
  endpoint: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult> {
  const { userId, endpoint, limit, windowSec } = params;
  const key = `rl:${endpoint}:${userId}`;
  const redis = getRedisClient();

  if (!redis) {
    return checkRateLimitMemory(key, limit, windowSec * 1000);
  }

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSec);
    }
    if (count > limit) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        retryAfterSec: typeof ttl === "number" && ttl > 0 ? ttl : windowSec,
      };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch {
    // Fail open using in-memory fallback if Redis has transient issues.
    return checkRateLimitMemory(key, limit, windowSec * 1000);
  }
}
