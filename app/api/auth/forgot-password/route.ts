import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { issuePasswordResetTokenForUser } from "@/lib/passwordReset";
import { buildAppUrl } from "@/lib/appUrl";
import { sendPasswordResetEmail } from "@/lib/transactionalEmail";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const GENERIC_MESSAGE =
  "If an account exists for that email, password reset instructions have been sent.";

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const rateLimit = await checkRateLimit({
      userId: body.email,
      endpoint: "/api/auth/forgot-password",
      limit: 5,
      windowSec: 15 * 60,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: GENERIC_MESSAGE },
        { status: 200, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
      );
    }

    const user = await db.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });

    if (user) {
      const token = await issuePasswordResetTokenForUser(user.id);
      const resetUrl = buildAppUrl(`/reset-password?token=${encodeURIComponent(token)}`, req);
      try {
        await sendPasswordResetEmail({
          to: body.email,
          resetUrl,
        });
      } catch (error) {
        // Keep forgot-password responses non-enumerating even if email delivery fails.
        console.error("[auth] Failed to send password reset email", error);
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch {
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  }
}
