import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const sessionId = req.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      const sessions = await db.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json({ sessions });
    }

    const messages = await db.message.findMany({
      where: { sessionId, userId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get history." },
      { status: 401 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const session = await db.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    await db.chatSession.delete({ where: { id: sessionId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete session." },
      { status: 400 }
    );
  }
}
