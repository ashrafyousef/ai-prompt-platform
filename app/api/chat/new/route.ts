import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export async function POST() {
  try {
    const userId = await requireUserId();
    const session = await db.chatSession.create({
      data: { userId, title: "New Chat" },
    });
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create chat." },
      { status: 401 }
    );
  }
}
