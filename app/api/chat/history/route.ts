import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authErrorStatus, requireUserIdWithWorkspace } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireUserIdWithWorkspace();
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    const search = req.nextUrl.searchParams.get("search")?.trim();

    if (!sessionId) {
      const sessions = await db.chatSession.findMany({
        where: search
          ? {
              userId,
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                {
                  messages: {
                    some: {
                      content: { contains: search, mode: "insensitive" },
                    },
                  },
                },
              ],
            }
          : { userId },
        orderBy: { updatedAt: "desc" },
        take: 100,
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
      { status: authErrorStatus(error, 401) }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await requireUserIdWithWorkspace();
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
      { status: authErrorStatus(error, 400) }
    );
  }
}
