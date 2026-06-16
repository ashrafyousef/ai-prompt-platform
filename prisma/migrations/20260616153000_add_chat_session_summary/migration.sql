-- Add nullable ChatSession.summary (present in schema.prisma, missing from beta DB)
ALTER TABLE "ChatSession" ADD COLUMN IF NOT EXISTS "summary" TEXT;
