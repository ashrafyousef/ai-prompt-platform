import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminUserId } from "@/lib/adminAuth";

export async function GET() {
  try {
    await requireAdminUserId();
    const teams = await db.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    return NextResponse.json({ teams });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load teams.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
