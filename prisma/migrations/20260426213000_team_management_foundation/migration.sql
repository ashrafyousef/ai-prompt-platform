-- AlterTable
ALTER TABLE "Team"
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Team_isArchived_idx" ON "Team"("isArchived");
