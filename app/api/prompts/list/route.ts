import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authErrorStatus, requireUserIdWithWorkspace } from "@/lib/auth";

export async function GET() {
  try {
    const { userId } = await requireUserIdWithWorkspace();
    const prompts = await db.savedPrompt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, promptText: true, outputText: true, createdAt: true },
    });
    return NextResponse.json({ prompts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: authErrorStatus(error, 400) }
    );
  }
}
