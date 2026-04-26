import crypto from "crypto";
import { db } from "@/lib/db";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function issuePasswordResetTokenForUser(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db.$transaction([
    db.passwordResetToken.deleteMany({
      where: { userId },
    }),
    db.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return rawToken;
}

export async function consumePasswordResetToken(
  rawToken: string
): Promise<{ userId: string } | null> {
  const tokenHash = hashResetToken(rawToken);
  const now = new Date();

  const tokenRecord = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt <= now) {
    return null;
  }

  const updated = await db.passwordResetToken.updateMany({
    where: {
      id: tokenRecord.id,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });

  if (updated.count !== 1) {
    return null;
  }

  return { userId: tokenRecord.userId };
}
