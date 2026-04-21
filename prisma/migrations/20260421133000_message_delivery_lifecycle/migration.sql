-- Message assistant-attempt lifecycle + retry lineage persistence
CREATE TYPE "MessageDeliveryStatus" AS ENUM (
  'PENDING',
  'STREAMING',
  'FAILED',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "Message"
ADD COLUMN "turnId" TEXT,
ADD COLUMN "deliveryStatus" "MessageDeliveryStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN "retryOfAssistantMessageId" TEXT,
ADD COLUMN "attemptIndex" INTEGER,
ADD COLUMN "errorCode" TEXT,
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "provider" TEXT,
ADD COLUMN "model" TEXT,
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "failedAt" TIMESTAMP(3);

ALTER TABLE "Message"
ADD CONSTRAINT "Message_retryOfAssistantMessageId_fkey"
FOREIGN KEY ("retryOfAssistantMessageId") REFERENCES "Message"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Message_retryOfAssistantMessageId_idx" ON "Message"("retryOfAssistantMessageId");
CREATE INDEX "Message_sessionId_turnId_createdAt_idx" ON "Message"("sessionId", "turnId", "createdAt");
CREATE INDEX "Message_sessionId_turnId_attemptIndex_idx" ON "Message"("sessionId", "turnId", "attemptIndex");
