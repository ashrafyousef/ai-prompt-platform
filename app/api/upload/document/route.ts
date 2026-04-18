import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/json": "json",
};

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt", "md", "csv", "json"]);

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const limit = await checkRateLimit({
      userId,
      endpoint: "/api/upload/document",
      limit: 20,
      windowSec: 60,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }

    const rawExt = (file.name.split(".").pop() ?? "").toLowerCase();
    const extFromMime = ALLOWED_TYPES[file.type];
    const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : extFromMime;

    if (!ext) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}.` },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "docs");
    await mkdir(uploadsDir, { recursive: true });

    const storedName = `${randomUUID()}.${ext}`;
    const absolutePath = path.join(uploadsDir, storedName);
    await writeFile(absolutePath, bytes);

    const url = `/uploads/docs/${storedName}`;

    return NextResponse.json({
      url,
      fileName: file.name,
      storedName,
      mimeType: file.type || `application/${ext}`,
      sizeBytes: file.size,
      ext,
      uploadedAt: new Date().toISOString(),
      processingStatus: "pending",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
