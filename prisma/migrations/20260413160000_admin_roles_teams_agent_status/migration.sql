-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'TEAM_LEAD', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AgentScope" AS ENUM ('TEAM', 'GLOBAL');

-- CreateTable
CREATE TABLE IF NOT EXISTS "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Team_slug_key" ON "Team"("slug");
CREATE INDEX IF NOT EXISTS "Team_slug_idx" ON "Team"("slug");

-- AlterTable
ALTER TABLE "AgentConfig" ADD COLUMN IF NOT EXISTS "status" "AgentStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "AgentConfig" ADD COLUMN IF NOT EXISTS "scope" "AgentScope" NOT NULL DEFAULT 'GLOBAL';
ALTER TABLE "AgentConfig" ADD COLUMN IF NOT EXISTS "teamId" TEXT;

-- AddForeignKey
DO $$ BEGIN
 ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentConfig_teamId_idx" ON "AgentConfig"("teamId");
CREATE INDEX IF NOT EXISTS "AgentConfig_status_idx" ON "AgentConfig"("status");
CREATE INDEX IF NOT EXISTS "AgentConfig_scope_idx" ON "AgentConfig"("scope");
