-- CreateEnum
CREATE TYPE "StrategyStatus" AS ENUM ('DRAFT', 'READY_FOR_CREATIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceBriefId" TEXT NOT NULL,
    "status" "StrategyStatus" NOT NULL DEFAULT 'DRAFT',
    "responsesJson" JSONB,
    "readyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Strategy_projectId_key" ON "Strategy"("projectId");

-- CreateIndex
CREATE INDEX "Strategy_status_idx" ON "Strategy"("status");

-- CreateIndex
CREATE INDEX "Strategy_sourceBriefId_idx" ON "Strategy"("sourceBriefId");

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_sourceBriefId_fkey" FOREIGN KEY ("sourceBriefId") REFERENCES "Brief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
