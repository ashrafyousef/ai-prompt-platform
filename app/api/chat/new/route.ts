import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authErrorStatus, requireUserIdWithWorkspace } from "@/lib/auth";

export async function POST() {
  try {
    const { userId } = await requireUserIdWithWorkspace();
    const session = await db.chatSession.create({
      data: { userId, title: "New Chat" },
    });
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create chat." },
      { status: authErrorStatus(error, 401) }
    );
  }
}
