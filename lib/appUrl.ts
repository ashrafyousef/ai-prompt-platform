import type { NextRequest } from "next/server";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate.startsWith("http") ? candidate : `https://${candidate}`);
    return trimTrailingSlash(parsed.toString());
  } catch {
    return null;
  }
}

/**
 * Resolve base app URL for email links.
 * Priority:
 * 1) APP_BASE_URL (explicit deployment-safe override)
 * 2) Request forwarded host/proto
 * 3) request.nextUrl.origin
 * 4) NEXTAUTH_URL fallback
 */
export function resolveAppBaseUrl(req?: NextRequest): string {
  const explicit = normalizeUrl(process.env.APP_BASE_URL ?? "");
  if (explicit) return explicit;

  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
    if (forwardedHost) {
      const byForwarded = normalizeUrl(`${forwardedProto}://${forwardedHost}`);
      if (byForwarded) return byForwarded;
    }
    const origin = normalizeUrl(req.nextUrl.origin);
    if (origin) return origin;
  }

  const nextAuth = normalizeUrl(process.env.NEXTAUTH_URL ?? "");
  if (nextAuth) return nextAuth;

  const vercel = normalizeUrl(process.env.VERCEL_URL ?? "");
  if (vercel) return vercel;

  return "http://localhost:3000";
}

export function buildAppUrl(path: string, req?: NextRequest): string {
  const base = resolveAppBaseUrl(req);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
