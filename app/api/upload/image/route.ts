import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { authErrorStatus, requireUserIdWithWorkspace } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

const UPLOAD_UNAVAILABLE_MESSAGE =
  "Image upload storage is not configured for this environment. Attachments are unavailable until cloud storage is set up.";

const UPLOAD_GENERIC_FAILURE_MESSAGE =
  "Image upload failed. Please try again or contact support if this persists.";

function isLocalUploadSupported(): boolean {
  if (process.env.VERCEL === "1") return false;
  if (process.env.IMAGE_UPLOAD_LOCAL === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireUserIdWithWorkspace();
    const limit = await checkRateLimit({
      userId,
      endpoint: "/api/upload/image",
      limit: 10,
      windowSec: 60,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    if (!isLocalUploadSupported()) {
      return NextResponse.json({ error: UPLOAD_UNAVAILABLE_MESSAGE }, { status: 503 });
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);
    const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Image is required." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10 MB." },
        { status: 400 }
      );
    }

    const rawExt = (file.name.split(".").pop() ?? "").toLowerCase();
    const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : "png";

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const fileName = `${randomUUID()}.${ext}`;
    const absolutePath = path.join(uploadsDir, fileName);
    await writeFile(absolutePath, bytes);

    return NextResponse.json({ url: `/uploads/${fileName}` });
  } catch (error) {
    const status = authErrorStatus(error, 500);
    if (status === 401) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (status === 403) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    console.error("[upload/image]", error);
    return NextResponse.json({ error: UPLOAD_GENERIC_FAILURE_MESSAGE }, { status: 500 });
  }
}
