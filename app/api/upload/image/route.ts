import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireUserId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await requireUserId();
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Image is required." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const ext = file.name.split(".").pop() ?? "png";
    const fileName = `${randomUUID()}.${ext}`;
    const absolutePath = path.join(uploadsDir, fileName);
    await writeFile(absolutePath, bytes);

    return NextResponse.json({ url: `/uploads/${fileName}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 401 }
    );
  }
}
