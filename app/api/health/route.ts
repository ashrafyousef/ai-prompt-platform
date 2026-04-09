import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkOpenAiReachable } from "@/lib/openai/client";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

async function checkDatabase(timeoutMs = 3000): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const timer = new Promise<false>((resolve) => {
    setTimeout(() => resolve(false), timeoutMs);
  });
  const probe = db.$queryRaw`SELECT 1`
    .then(() => true)
    .catch(() => false);
  return Promise.race([probe, timer]);
}

export async function GET() {
  try {
    const [databaseOk, openaiOk] = await Promise.all([
      checkDatabase(),
      checkOpenAiReachable(3000),
    ]);
    return NextResponse.json({
      status: "ok",
      database: databaseOk ? "connected" : "error",
      openai: openaiOk ? "reachable" : "error",
    });
  } catch (error) {
    captureError(error, { route: "/api/health" });
    return NextResponse.json({
      status: "ok",
      database: "error",
      openai: "error",
    });
  }
}
