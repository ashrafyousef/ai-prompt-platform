import { NextRequest, NextResponse } from "next/server";
import { authErrorStatus, requireUserIdWithWorkspace } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  IMAGE_UPLOAD_UNAVAILABLE_MESSAGE,
  detectImageTypeFromBytes,
  isBlobStorageConfigured,
  normalizeClaimedImageMime,
  saveChatImage,
  shouldUseLocalImageStorage,
} from "@/lib/imageStorage";

const UPLOAD_GENERIC_FAILURE_MESSAGE =
  "Image upload failed. Please try again or contact support if this persists.";

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

    if (!shouldUseLocalImageStorage() && !isBlobStorageConfigured()) {
      return NextResponse.json({ error: IMAGE_UPLOAD_UNAVAILABLE_MESSAGE }, { status: 503 });
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);

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

    const bytes = Buffer.from(await file.arrayBuffer());
    const detected = detectImageTypeFromBytes(bytes);
    if (!detected) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP." },
        { status: 400 }
      );
    }

    const claimedMime = normalizeClaimedImageMime(file.type);
    if (!claimedMime || claimedMime !== detected.mime) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP." },
        { status: 400 }
      );
    }

    const { url } = await saveChatImage({
      bytes,
      ext: detected.ext,
      contentType: detected.mime,
      userId,
    });

    return NextResponse.json({ url });
  } catch (error) {
    const status = authErrorStatus(error, 500);
    if (status === 401) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (status === 403) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (error instanceof Error && error.message === "BLOB_STORAGE_NOT_CONFIGURED") {
      return NextResponse.json({ error: IMAGE_UPLOAD_UNAVAILABLE_MESSAGE }, { status: 503 });
    }

    console.error("[upload/image]", error);
    return NextResponse.json({ error: UPLOAD_GENERIC_FAILURE_MESSAGE }, { status: 500 });
  }
}
