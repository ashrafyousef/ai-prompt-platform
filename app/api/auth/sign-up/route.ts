import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { allowInitialSignUp } from "@/lib/authBootstrap";
import { slugifyWorkspaceName } from "@/lib/workspaceSlug";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const signUpSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120),
  workspaceName: z.string().trim().min(1).max(120),
});

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return "unknown";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = await checkRateLimit({
    userId: `signup:${ip}`,
    endpoint: "/api/auth/sign-up",
    limit: 5,
    windowSec: 3600,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  if (!(await allowInitialSignUp())) {
    return NextResponse.json({ error: "Sign-up is not available." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input.", details: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const { password, name, workspaceName } = parsed.data;

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const baseSlug = slugifyWorkspaceName(workspaceName);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: "ADMIN",
        },
      });
      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          slug,
        },
      });
      await tx.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: "OWNER",
        },
      });
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not complete registration." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email });
}
