import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

const schema = z.object({
  sessionId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
});

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = schema.parse(await req.json());

    const session = await db.chatSession.findFirst({
      where: { id: body.sessionId, userId },
      select: { id: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const updated = await db.chatSession.update({
      where: { id: body.sessionId },
      data: { title: body.title.trim() },
    });

    return NextResponse.json({ session: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update title." },
      { status: 400 }
    );
  }
}
