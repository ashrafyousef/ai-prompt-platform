import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  sessionId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const payload = schema.parse(await req.json());

    const session = await db.chatSession.findFirst({
      where: { id: payload.sessionId, userId },
      select: { id: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const share = await db.sharedChat.create({
      data: {
        sessionId: payload.sessionId,
        token: randomUUID(),
      },
    });
    const baseUrl = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
    return NextResponse.json({
      url: `${baseUrl}/share/${share.id}?token=${share.token}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create share link." },
      { status: 400 }
    );
  }
}
