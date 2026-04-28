import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { consumePasswordResetToken } from "@/lib/passwordReset";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const consumed = await consumePasswordResetToken(body.token);
    if (!consumed) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired.", code: "INVALID_OR_EXPIRED_TOKEN" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(body.password);
    await db.$transaction([
      db.user.update({
        where: { id: consumed.userId },
        data: { passwordHash },
      }),
      db.passwordResetToken.deleteMany({
        where: { userId: consumed.userId },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Password must be between 8 and 128 characters.", code: "INVALID_PASSWORD" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Unable to reset password right now.", code: "RESET_FAILED" },
      { status: 500 }
    );
  }
}
