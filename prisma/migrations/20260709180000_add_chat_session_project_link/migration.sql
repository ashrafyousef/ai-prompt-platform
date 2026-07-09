-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "ChatSession_projectId_userId_updatedAt_idx" ON "ChatSession"("projectId", "userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
