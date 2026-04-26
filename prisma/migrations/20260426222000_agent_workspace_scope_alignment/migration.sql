-- AlterTable
ALTER TABLE "AgentConfig"
ADD COLUMN "workspaceId" TEXT;

-- Backfill workspaceId from team ownership first
UPDATE "AgentConfig" a
SET "workspaceId" = t."workspaceId"
FROM "Team" t
WHERE a."teamId" = t."id"
  AND t."workspaceId" IS NOT NULL
  AND a."workspaceId" IS NULL;

-- Backfill any remaining rows to first workspace (Phase 2.1 transitional)
WITH first_workspace AS (
  SELECT "id" FROM "Workspace" ORDER BY "createdAt" ASC LIMIT 1
)
UPDATE "AgentConfig"
SET "workspaceId" = (SELECT "id" FROM first_workspace)
WHERE "workspaceId" IS NULL;

-- Enforce non-null
ALTER TABLE "AgentConfig"
ALTER COLUMN "workspaceId" SET NOT NULL;

-- Add foreign key
ALTER TABLE "AgentConfig"
ADD CONSTRAINT "AgentConfig_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index
CREATE INDEX "AgentConfig_workspaceId_idx" ON "AgentConfig"("workspaceId");
