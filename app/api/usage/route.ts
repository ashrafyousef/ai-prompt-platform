import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await requireUserId();
    const result = await db.tokenUsage.aggregate({
      where: { userId },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: { id: true },
    });
    return NextResponse.json({
      totalTokens: result._sum.totalTokens ?? 0,
      promptTokens: result._sum.promptTokens ?? 0,
      completionTokens: result._sum.completionTokens ?? 0,
      requestCount: result._count.id ?? 0,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 400 });
  }
}
