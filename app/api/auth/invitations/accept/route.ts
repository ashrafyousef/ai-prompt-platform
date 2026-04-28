import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rateLimit";
import { getInvitationByRawToken } from "@/lib/workspaceInvitations";

const schema = z
  .object({
    token: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasPassword = typeof value.password === "string" && value.password.length > 0;
    const hasConfirm = typeof value.confirmPassword === "string" && value.confirmPassword.length > 0;
    if (hasPassword || hasConfirm) {
      if (!value.password || value.password.length < 8 || value.password.length > 128) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must be between 8 and 128 characters.",
          path: ["password"],
        });
      }
      if (value.password !== value.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passwords do not match.",
          path: ["confirmPassword"],
        });
      }
    }
  });

function invitationState(invitation: {
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}): "valid" | "expired" | "accepted" | "revoked" {
  if (invitation.revokedAt) return "revoked";
  if (invitation.acceptedAt) return "accepted";
  if (invitation.expiresAt <= new Date()) return "expired";
  return "valid";
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const invitation = await getInvitationByRawToken(body.token);
    if (!invitation) {
      return NextResponse.json({ error: "Invalid invite link.", code: "INVALID_INVITE" }, { status: 400 });
    }

    const state = invitationState(invitation);
    if (state !== "valid") {
      return NextResponse.json(
        { error: "This invitation is no longer valid.", code: state.toUpperCase() },
        { status: 400 }
      );
    }

    const limit = await checkRateLimit({
      userId: `invite-accept:${invitation.email}`,
      endpoint: "/api/auth/invitations/accept",
      limit: 20,
      windowSec: 3600,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email: invitation.email },
      select: { id: true, passwordHash: true, name: true },
    });

    if (!existingUser || !existingUser.passwordHash) {
      if (!body.password || body.password.length < 8) {
        return NextResponse.json(
          { error: "A password is required to finish onboarding.", code: "PASSWORD_REQUIRED" },
          { status: 400 }
        );
      }
    }

    const accepted = await db.$transaction(async (tx) => {
      const current = await tx.workspaceInvitation.findUnique({
        where: { id: invitation.id },
        select: {
          id: true,
          email: true,
          role: true,
          teamId: true,
          workspaceId: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
        },
      });
      if (!current) return { ok: false as const, code: "INVALID" };
      const currentState = invitationState(current);
      if (currentState !== "valid") return { ok: false as const, code: currentState };

      let user = await tx.user.findUnique({
        where: { email: current.email },
        select: { id: true, passwordHash: true },
      });
      if (!user) {
        user = await tx.user.create({
          data: {
            email: current.email,
            name: body.name,
            passwordHash: await hashPassword(body.password!),
          },
          select: { id: true, passwordHash: true },
        });
      } else if (!user.passwordHash && body.password) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            name: body.name,
            passwordHash: await hashPassword(body.password),
          },
        });
      } else if (body.name.trim()) {
        await tx.user.update({
          where: { id: user.id },
          data: { name: body.name },
        });
      }

      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: current.workspaceId,
            userId: user.id,
          },
        },
        create: {
          workspaceId: current.workspaceId,
          userId: user.id,
          role: current.role,
          teamId: current.teamId,
          isActive: true,
        },
        update: {
          role: current.role,
          teamId: current.teamId,
          isActive: true,
        },
      });

      const consumed = await tx.workspaceInvitation.updateMany({
        where: {
          id: current.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          acceptedAt: new Date(),
        },
      });

      if (consumed.count !== 1) return { ok: false as const, code: "ALREADY_USED" };
      return { ok: true as const };
    });

    if (!accepted.ok) {
      return NextResponse.json(
        { error: "This invitation is no longer valid.", code: accepted.code },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, email: invitation.email });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Invalid invite acceptance input."
        : error instanceof Error
          ? error.message
          : "Failed to accept invitation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
