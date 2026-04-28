import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authErrorStatus, requireAuthorizedUserContext } from "@/lib/auth";
import { getUsageGovernanceSnapshot } from "@/lib/usage";
import { countExactUsageRequests } from "@/lib/tokenUsageCompat";
import { ROLE_LIMITS, type UserRole } from "@/lib/models";

export async function GET() {
  try {
    const auth = await requireAuthorizedUserContext();
    const userId = auth.userId;
    const userRole = auth.role as UserRole;
    const teamId = auth.teamId;

    const [allTime, exactCount, governance] = await Promise.all([
      db.tokenUsage.aggregate({
        where: { userId },
        _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
        _count: { id: true },
      }),
      countExactUsageRequests(userId),
      getUsageGovernanceSnapshot({
        userId,
        userRole,
        teamId,
      }),
    ]);

    const roleLimits = ROLE_LIMITS[userRole] ?? ROLE_LIMITS.USER;

    return NextResponse.json({
      totalTokens: allTime._sum.totalTokens ?? 0,
      promptTokens: allTime._sum.promptTokens ?? 0,
      completionTokens: allTime._sum.completionTokens ?? 0,
      requestCount: allTime._count.id ?? 0,
      /** Rows logged with provider-reported token counts (streaming or non-stream). */
      exactUsageRequestCount: exactCount,
      monthly: governance.user,
      teamMonthly: governance.team,
      role: userRole,
      allowedCostTiers: roleLimits.allowedCostTiers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: authErrorStatus(error, 400) }
    );
  }
}
