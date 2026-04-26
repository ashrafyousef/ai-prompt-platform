import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorStatus, requireAuthorizedUserContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "New password and confirm password must match.",
  });

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthorizedUserContext();
    const body = schema.parse(await req.json());
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Password login is not available." }, { status: 400 });
    }

    const valid = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    const nextHash = await hashPassword(body.newPassword);
    await db.user.update({
      where: { id: auth.userId },
      data: { passwordHash: nextHash },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : authErrorStatus(error, 500);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to change password." },
      { status }
    );
  }
}
