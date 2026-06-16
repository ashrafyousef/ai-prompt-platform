/**
 * Idempotent Beta 1.2 agent baseline seed (Phase 2A).
 *
 * Creates/updates:
 * - Visual Director (published, active)
 * - Nur - Creative Director (draft, inactive placeholder)
 *
 * Safety: refuses to run unless DATABASE_URL contains the approved beta Neon host.
 */
const { PrismaClient } = require("@prisma/client");
const { BETA_AGENT_BASELINES } = require("../prisma/agentBaselineDefinitions");

const BETA_NEON_HOST = "ep-super-lake-a27auead.eu-central-1.aws.neon.tech";

function assertBetaDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl.trim()) {
    throw new Error("DATABASE_URL is not set.");
  }
  if (!databaseUrl.includes(BETA_NEON_HOST)) {
    throw new Error(
      `Refusing to seed agent baseline: DATABASE_URL must contain beta host "${BETA_NEON_HOST}".`
    );
  }
}

async function resolveTargetWorkspace(prisma) {
  const workspaceSlug = process.env.AGENT_BASELINE_WORKSPACE_SLUG?.trim();
  if (workspaceSlug) {
    const workspace = await prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!workspace) {
      throw new Error(`Workspace not found for slug: ${workspaceSlug}`);
    }
    return workspace;
  }

  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });
  if (!workspace) {
    throw new Error("No workspace found. Create the beta workspace before seeding agents.");
  }
  return workspace;
}

async function main() {
  assertBetaDatabaseUrl();

  const prisma = new PrismaClient();
  try {
    const workspace = await resolveTargetWorkspace(prisma);
    console.info(`[seed-beta-agent-baseline] workspace: ${workspace.name} (${workspace.slug})`);

    for (const agent of BETA_AGENT_BASELINES) {
      const {
        slug,
        name,
        description,
        systemPrompt,
        outputFormat,
        temperature,
        maxTokens,
        status,
        isEnabled,
        scope,
        teamId,
        inputSchema,
      } = agent;

      const data = {
        name,
        description,
        systemPrompt,
        outputFormat,
        temperature,
        maxTokens,
        status,
        isEnabled,
        scope,
        workspaceId: workspace.id,
        teamId,
        inputSchema,
      };

      const saved = await prisma.agentConfig.upsert({
        where: { slug },
        update: data,
        create: {
          slug,
          ...data,
        },
        select: { id: true, slug: true, name: true, status: true, isEnabled: true },
      });

      console.info(
        `[seed-beta-agent-baseline] upserted ${saved.slug} (${saved.name}) status=${saved.status} enabled=${saved.isEnabled}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
