import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authErrorStatus, requireUserIdWithWorkspace } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireUserIdWithWorkspace();
    await db.savedPrompt.deleteMany({ where: { id: params.id, userId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: authErrorStatus(error, 400) }
    );
  }
}
