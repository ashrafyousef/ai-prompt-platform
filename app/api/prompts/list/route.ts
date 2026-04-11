import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await requireUserId();
    const prompts = await db.savedPrompt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, promptText: true, outputText: true, createdAt: true },
    });
    return NextResponse.json({ prompts });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 400 });
  }
}
