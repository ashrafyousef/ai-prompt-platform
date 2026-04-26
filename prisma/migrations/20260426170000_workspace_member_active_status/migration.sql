-- AlterTable
ALTER TABLE "WorkspaceMember"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "WorkspaceMember_isActive_idx" ON "WorkspaceMember"("isActive");
