import { db } from "@/lib/db";
import { getModelsForRole, ROLE_LIMITS, resolveModelById, type ModelOption, type UserRole } from "@/lib/models";

export type BudgetStatus = "ok" | "warning" | "blocked";

export type BudgetWindow = {
  used: number;
  softLimit: number;
  hardLimit: number;
  remaining: number;
  percentUsed: number;
  status: BudgetStatus;
};

export type UsageGovernanceSnapshot = {
  user: BudgetWindow;
  team: BudgetWindow | null;
};

function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function buildBudgetWindow(used: number, softLimit: number, hardLimit: number): BudgetWindow {
  const remaining = Math.max(0, hardLimit - used);
  const percentUsed = hardLimit > 0 ? Math.round((used / hardLimit) * 100) : 0;
  const status: BudgetStatus =
    hardLimit > 0 && used >= hardLimit
      ? "blocked"
      : softLimit > 0 && used >= softLimit
      ? "warning"
      : "ok";

  return { used, softLimit, hardLimit, remaining, percentUsed, status };
}

export async function getMonthlyUsage(userId: string) {
  const monthStart = getMonthStart();
  const aggregate = await db.tokenUsage.aggregate({
    where: { userId, createdAt: { gte: monthStart } },
    _sum: { totalTokens: true },
  });
  return aggregate._sum.totalTokens ?? 0;
}

export async function getMonthlyTeamUsage(teamId: string) {
  const monthStart = getMonthStart();
  const aggregate = await db.tokenUsage.aggregate({
    where: {
      createdAt: { gte: monthStart },
      user: { teamId },
    },
    _sum: { totalTokens: true },
  });
  return aggregate._sum.totalTokens ?? 0;
}

export async function getUsageGovernanceSnapshot(params: {
  userId: string;
  userRole: UserRole;
  teamId?: string | null;
  additionalEstimatedTokens?: number;
}) {
  const { userId, userRole, teamId, additionalEstimatedTokens = 0 } = params;
  const roleLimits = ROLE_LIMITS[userRole] ?? ROLE_LIMITS.USER;
  const userSoftLimit = Number(process.env.TOKEN_SOFT_LIMIT ?? roleLimits.monthlySoftTokenLimit);
  const userHardLimit = Number(process.env.TOKEN_HARD_LIMIT ?? roleLimits.monthlyHardTokenLimit);
  const teamSoftLimitRaw = Number(process.env.TEAM_TOKEN_SOFT_LIMIT ?? 0);
  const teamHardLimitRaw = Number(process.env.TEAM_TOKEN_HARD_LIMIT ?? 0);

  const [userUsed, teamUsed] = await Promise.all([
    getMonthlyUsage(userId),
    teamId ? getMonthlyTeamUsage(teamId) : Promise.resolve(0),
  ]);

  return {
    user: buildBudgetWindow(userUsed + additionalEstimatedTokens, userSoftLimit, userHardLimit),
    team:
      teamId && teamSoftLimitRaw > 0 && teamHardLimitRaw > 0
        ? buildBudgetWindow(teamUsed + additionalEstimatedTokens, teamSoftLimitRaw, teamHardLimitRaw)
        : null,
  } satisfies UsageGovernanceSnapshot;
}

export function applyGovernanceToModels(models: ModelOption[], snapshot: UsageGovernanceSnapshot) {
  const nearBudget = snapshot.user.status === "warning" || snapshot.team?.status === "warning";
  const hardBlocked = snapshot.user.status === "blocked" || snapshot.team?.status === "blocked";

  return models.map((model) => {
    if (hardBlocked) {
      return {
        ...model,
        enabled: false,
        disabledReason: snapshot.team?.status === "blocked"
          ? "Team monthly budget has been reached."
          : "Your monthly token budget has been reached.",
      };
    }

    if (nearBudget && model.costTier !== "low") {
      return {
        ...model,
        enabled: false,
        disabledReason: "Premium models are unavailable while you are near the monthly budget.",
      };
    }

    return model;
  });
}

export async function getGovernedModelsForUser(params: {
  userId: string;
  userRole: UserRole;
  teamId?: string | null;
  additionalEstimatedTokens?: number;
}) {
  const snapshot = await getUsageGovernanceSnapshot(params);
  const models = getModelsForRole(params.userRole);
  return {
    snapshot,
    models: applyGovernanceToModels(models, snapshot),
  };
}

export async function assertUserWithinSoftTokenLimit(params: {
  userId: string;
  additionalEstimatedTokens: number;
  userRole?: string;
  teamId?: string | null;
}) {
  const { userId, additionalEstimatedTokens, userRole, teamId } = params;
  const normalizedRole = (userRole ?? "USER") as UserRole;
  const snapshot = await getUsageGovernanceSnapshot({
    userId,
    userRole: normalizedRole,
    teamId,
    additionalEstimatedTokens,
  });

  if (snapshot.user.status === "blocked") {
    throw new Error("User token hard limit exceeded for this account.");
  }
  if (snapshot.team?.status === "blocked") {
    throw new Error("Team token hard limit exceeded for this team.");
  }
}

export function assertModelAccessForRole(modelId: string, userRole: string): void {
  const model = resolveModelById(modelId);
  if (!model) return;

  if (!model.allowedRoles.includes(userRole as UserRole)) {
    throw new Error(
      `Your role (${userRole}) does not have access to ${model.displayName}.`
    );
  }

  if (!model.enabled) {
    throw new Error(model.disabledReason ?? `${model.displayName} is currently unavailable.`);
  }
}
