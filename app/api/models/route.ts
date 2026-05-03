import { NextResponse } from "next/server";
import { authErrorStatus, requireAuthorizedUserContext } from "@/lib/auth";
import { detectProvider, ROLE_LIMITS } from "@/lib/models";
import { getPlatformModelGovernance, resolvePlatformModelDefaults } from "@/lib/platformModelGovernance";
import { getRecentRateLimitAdvisory } from "@/lib/modelHealthHints";
import { getGovernedModelsForUser } from "@/lib/usage";

export async function GET() {
  try {
    const auth = await requireAuthorizedUserContext();
    const role = auth.modelGovernanceRole;
    const provider = detectProvider();
    const limits = ROLE_LIMITS[role] ?? ROLE_LIMITS.USER;
    const { models, snapshot } = await getGovernedModelsForUser({
      userId: auth.userId,
      userRole: role,
      teamId: auth.teamId,
    });
    const { defaultModelId, fallbackModelId } = resolvePlatformModelDefaults(models);
    const platform = getPlatformModelGovernance();

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
        listSection: m.listSection ?? "curated",
        disabledReason: m.disabledReason ?? null,
        contextWindow: m.contextWindow,
        visionCapable: m.capabilities.includes("vision"),
        healthAdvisory: getRecentRateLimitAdvisory({
          modelId: m.id,
          provider: m.provider,
        }),
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
      workspacePolicy: {
        source: platform.policySource,
        defaultAgentId: platform.systemChatDefaults.defaultAgentId,
        enabledModelIds: platform.systemModelPolicy.enabledModelIds,
        configuredDefaultModelId: platform.systemModelPolicy.defaultModelId,
        configuredFallbackModelId: platform.systemModelPolicy.fallbackModelId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: authErrorStatus(error, 500) }
    );
  }
}
