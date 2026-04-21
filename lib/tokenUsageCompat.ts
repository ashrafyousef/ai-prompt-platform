import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { db } from "@/lib/db";

/** Cached after first successful read — avoids repeated failures if schema is behind. */
let exactUsageFilterSupported: boolean | undefined;

function isMissingExactUsageColumn(e: unknown): boolean {
  if (e instanceof PrismaClientKnownRequestError) {
    if (e.code === "P2022") return true;
    const msg = e.message ?? "";
    if (e.code === "P2010" && msg.includes("exactUsage")) return true;
    if (msg.includes("exactUsage") && msg.includes("does not exist")) return true;
  }
  return false;
}

/**
 * Count usage rows with provider-exact token counts. If `exactUsage` column is missing (DB not migrated),
 * returns `0` and caches so we do not spam errors. After migrating, restart the server to reset the cache.
 */
export async function countExactUsageRequests(userId: string): Promise<number> {
  if (exactUsageFilterSupported === false) {
    return 0;
  }
  try {
    const n = await db.tokenUsage.count({ where: { userId, exactUsage: true } });
    exactUsageFilterSupported = true;
    return n;
  } catch (e) {
    if (isMissingExactUsageColumn(e)) {
      exactUsageFilterSupported = false;
      console.warn(
        "[tokenUsageCompat] TokenUsage.exactUsage missing — run `npx prisma migrate deploy` and restart. Reporting exactUsageRequestCount as 0."
      );
      return 0;
    }
    throw e;
  }
}
