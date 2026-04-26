/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function toKnowledgeItems(inputSchema) {
  const schema = inputSchema && typeof inputSchema === "object" ? inputSchema : {};
  const modern = Array.isArray(schema.knowledgeItems) ? schema.knowledgeItems : [];
  if (modern.length > 0) return modern;

  const legacy = Array.isArray(schema.knowledge) ? schema.knowledge : [];
  return legacy
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const content = typeof item.content === "string" ? item.content.trim() : "";
      if (!content) return null;
      const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : `Knowledge item ${index + 1}`;
      const type = typeof item.type === "string" && item.type.trim() ? item.type.trim() : "manual_text";
      return {
        id: `legacy-${index + 1}`,
        title,
        sourceType: type,
        content,
        fileRef: null,
        summary: "",
        tags: [],
        priority: 3,
        appliesTo: "all",
        isActive: true,
        ownerNote: "",
        lastReviewedAt: null,
        processingStatus: "ready",
      };
    })
    .filter(Boolean);
}

async function backfillAgent(agent) {
  const items = toKnowledgeItems(agent.inputSchema);
  if (items.length === 0) return { createdItems: 0, createdLinks: 0, sourceItems: 0 };

  return prisma.$transaction(async (tx) => {
    let createdItems = 0;
    let createdLinks = 0;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const knowledge = await tx.knowledgeItem.create({
        data: {
          workspaceId: agent.workspaceId,
          teamId: agent.teamId ?? null,
          title: item.title,
          sourceType: item.sourceType || "manual_text",
          content: typeof item.content === "string" ? item.content : null,
          fileRef: item.fileRef ?? undefined,
          summary: typeof item.summary === "string" ? item.summary : "",
          tags: Array.isArray(item.tags) ? item.tags : [],
          priority: Number.isFinite(item.priority) ? item.priority : 3,
          appliesTo: typeof item.appliesTo === "string" && item.appliesTo ? item.appliesTo : "all",
          isActive: item.isActive !== false,
          ownerNote: typeof item.ownerNote === "string" ? item.ownerNote : "",
          lastReviewedAt: item.lastReviewedAt ? new Date(item.lastReviewedAt) : null,
          processingStatus: typeof item.processingStatus === "string" ? item.processingStatus : "ready",
        },
        select: { id: true },
      });
      createdItems += 1;

      await tx.agentKnowledge.create({
        data: {
          agentId: agent.id,
          knowledgeId: knowledge.id,
          legacyItemId: typeof item.id === "string" ? item.id : null,
          sortOrder: i,
        },
      });
      createdLinks += 1;
    }
    return { createdItems, createdLinks, sourceItems: items.length };
  });
}

async function main() {
  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");
  const verbose = process.argv.includes("--verbose");
  const agents = await prisma.agentConfig.findMany({
    select: {
      id: true,
      name: true,
      workspaceId: true,
      teamId: true,
      inputSchema: true,
      _count: { select: { knowledgeLinks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  let scanned = 0;
  let skipped = 0;
  let hydrated = 0;
  let createdItems = 0;
  let createdLinks = 0;
  let noKnowledge = 0;
  let candidates = 0;
  const workspaceSummary = new Map();

  for (const agent of agents) {
    scanned += 1;
    const sourceItems = toKnowledgeItems(agent.inputSchema).length;
    if (!force && agent._count.knowledgeLinks > 0) {
      skipped += 1;
      const ws = workspaceSummary.get(agent.workspaceId) ?? { scanned: 0, skipped: 0, hydrated: 0, sourceItems: 0 };
      ws.scanned += 1;
      ws.skipped += 1;
      ws.sourceItems += sourceItems;
      workspaceSummary.set(agent.workspaceId, ws);
      continue;
    }
    candidates += 1;
    if (sourceItems === 0) noKnowledge += 1;

    const result = dryRun
      ? { createdItems: 0, createdLinks: 0, sourceItems }
      : await backfillAgent(agent);
    if (result.createdLinks > 0) hydrated += 1;
    createdItems += result.createdItems;
    createdLinks += result.createdLinks;
    const ws = workspaceSummary.get(agent.workspaceId) ?? { scanned: 0, skipped: 0, hydrated: 0, sourceItems: 0 };
    ws.scanned += 1;
    ws.hydrated += result.createdLinks > 0 ? 1 : 0;
    ws.sourceItems += result.sourceItems;
    workspaceSummary.set(agent.workspaceId, ws);
    if (verbose) {
      console.log(
        `[knowledge-backfill] ${dryRun ? "DRY-RUN" : "APPLY"} agent=${agent.id} name="${agent.name}" sourceItems=${result.sourceItems} createdLinks=${result.createdLinks}`
      );
    }
  }

  const workspaces = Array.from(workspaceSummary.entries()).map(([workspaceId, stats]) => ({
    workspaceId,
    ...stats,
  }));

  console.log(`Knowledge backfill ${dryRun ? "dry-run" : "complete"}.`);
  console.log(
    JSON.stringify(
      {
        scanned,
        candidates,
        skipped,
        noKnowledge,
        hydrated,
        createdItems,
        createdLinks,
        force,
        dryRun,
        verbose,
        workspaces,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Knowledge backfill failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
