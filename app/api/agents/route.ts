import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export async function GET() {
  try {
    await requireUserId();
    const agents = await db.agentConfig.findMany({
      where: { isEnabled: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load agents." },
      { status: 401 }
    );
  }
}
