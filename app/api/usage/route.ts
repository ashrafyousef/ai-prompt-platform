import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getUsageGovernanceSnapshot } from "@/lib/usage";
import { ROLE_LIMITS, type UserRole } from "@/lib/models";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = (session.user.role ?? "USER") as UserRole;
    const teamId = session.user.teamId ?? null;

    const [allTime, governance] = await Promise.all([
      db.tokenUsage.aggregate({
        where: { userId },
        _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
        _count: { id: true },
      }),
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
      monthly: governance.user,
      teamMonthly: governance.team,
      role: userRole,
      allowedCostTiers: roleLimits.allowedCostTiers,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 400 });
  }
}
