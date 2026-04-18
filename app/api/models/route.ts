import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  detectProvider,
  resolveConfiguredDefaultModelId,
  resolveConfiguredFallbackModelId,
  ROLE_LIMITS,
  type UserRole,
} from "@/lib/models";
import { getGovernedModelsForUser } from "@/lib/usage";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user.role ?? "USER") as UserRole;
    const provider = detectProvider();
    const limits = ROLE_LIMITS[role] ?? ROLE_LIMITS.USER;
    const { models, snapshot } = await getGovernedModelsForUser({
      userId: session.user.id,
      userRole: role,
      teamId: session.user.teamId ?? null,
    });
    const defaultModelId = resolveConfiguredDefaultModelId(models);
    const fallbackModelId = resolveConfiguredFallbackModelId(models);

    return NextResponse.json({
      models: models.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        provider: m.provider,
        shortDescription: m.shortDescription,
        capabilities: m.capabilities,
        costTier: m.costTier,
        allowedRoles: m.allowedRoles,
        enabled: m.enabled,
        preferredFor: m.preferredFor ?? [],
        disabledReason: m.disabledReason ?? null,
        contextWindow: m.contextWindow,
        visionCapable: m.capabilities.includes("vision"),
      })),
      activeRuntimeProvider: provider,
      role,
      monthlyTokenLimit: snapshot.user.hardLimit,
      allowedCostTiers: limits.allowedCostTiers,
      governance: snapshot,
      defaults: {
        defaultModelId,
        fallbackModelId,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
