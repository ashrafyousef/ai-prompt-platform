import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

const schema = z.object({
  title: z.string().min(1),
  promptText: z.string().min(1),
  outputText: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = schema.parse(await req.json());
    const saved = await db.savedPrompt.create({
      data: { userId, ...body },
    });
    return NextResponse.json({ saved });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save prompt." },
      { status: 400 }
    );
  }
}
