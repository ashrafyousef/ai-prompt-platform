-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "content" TEXT,
    "fileRef" JSONB,
    "summary" TEXT NOT NULL DEFAULT '',
    "tags" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "appliesTo" TEXT NOT NULL DEFAULT 'all',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerNote" TEXT NOT NULL DEFAULT '',
    "lastReviewedAt" TIMESTAMP(3),
    "processingStatus" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentKnowledge" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "legacyItemId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeItem_workspaceId_idx" ON "KnowledgeItem"("workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeItem_teamId_idx" ON "KnowledgeItem"("teamId");

-- CreateIndex
CREATE INDEX "KnowledgeItem_isActive_idx" ON "KnowledgeItem"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AgentKnowledge_agentId_knowledgeId_key" ON "AgentKnowledge"("agentId", "knowledgeId");

-- CreateIndex
CREATE INDEX "AgentKnowledge_agentId_idx" ON "AgentKnowledge"("agentId");

-- CreateIndex
CREATE INDEX "AgentKnowledge_knowledgeId_idx" ON "AgentKnowledge"("knowledgeId");

-- CreateIndex
CREATE INDEX "AgentKnowledge_legacyItemId_idx" ON "AgentKnowledge"("legacyItemId");

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentKnowledge" ADD CONSTRAINT "AgentKnowledge_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentKnowledge" ADD CONSTRAINT "AgentKnowledge_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
