import { db } from "@/lib/db";

export async function assertUserWithinSoftTokenLimit(params: {
  userId: string;
  additionalEstimatedTokens: number;
}) {
  const { userId, additionalEstimatedTokens } = params;
  const softLimit = Number(process.env.TOKEN_SOFT_LIMIT ?? 200000);
  if (!Number.isFinite(softLimit) || softLimit <= 0) return;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const aggregate = await db.tokenUsage.aggregate({
    where: { userId, createdAt: { gte: monthStart } },
    _sum: { totalTokens: true },
  });
  const used = aggregate._sum.totalTokens ?? 0;
  if (used + additionalEstimatedTokens > softLimit) {
    throw new Error("Token soft limit exceeded for this account.");
  }
}
