-- AlterTable Team: add workspace ownership
ALTER TABLE "Team"
ADD COLUMN "workspaceId" TEXT;

-- AlterTable WorkspaceMember: move team assignment to membership
ALTER TABLE "WorkspaceMember"
ADD COLUMN "teamId" TEXT;

-- Backfill Team.workspaceId using first workspace (Phase 1.9 transitional)
WITH first_workspace AS (
  SELECT "id" FROM "Workspace" ORDER BY "createdAt" ASC LIMIT 1
)
UPDATE "Team"
SET "workspaceId" = (SELECT "id" FROM first_workspace)
WHERE "workspaceId" IS NULL;

-- Backfill WorkspaceMember.teamId from legacy User.teamId
UPDATE "WorkspaceMember" wm
SET "teamId" = u."teamId"
FROM "User" u
WHERE wm."userId" = u."id"
  AND u."teamId" IS NOT NULL;

-- Add foreign keys
ALTER TABLE "Team"
ADD CONSTRAINT "Team_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember"
ADD CONSTRAINT "WorkspaceMember_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "Team_workspaceId_idx" ON "Team"("workspaceId");
CREATE INDEX "WorkspaceMember_teamId_idx" ON "WorkspaceMember"("teamId");
