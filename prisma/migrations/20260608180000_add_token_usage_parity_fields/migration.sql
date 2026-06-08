-- Additive TokenUsage parity fields aligned with prisma/schema.prisma
ALTER TABLE "TokenUsage"
ADD COLUMN "messageId" TEXT,
ADD COLUMN "registryModelId" TEXT,
ADD COLUMN "provider" TEXT,
ADD COLUMN "cachedInputTokens" INTEGER,
ADD COLUMN "exactUsage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "estimationMethod" TEXT,
ADD COLUMN "pricingSnapshot" JSONB,
ADD COLUMN "inputCost" DOUBLE PRECISION,
ADD COLUMN "outputCost" DOUBLE PRECISION,
ADD COLUMN "totalCost" DOUBLE PRECISION,
ADD COLUMN "currency" TEXT,
ADD COLUMN "serviceTier" TEXT,
ADD COLUMN "routerMode" TEXT,
ADD COLUMN "routerReasonCodes" JSONB;

CREATE INDEX "TokenUsage_messageId_idx" ON "TokenUsage"("messageId");
