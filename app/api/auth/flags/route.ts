import { NextResponse } from "next/server";
import { allowInitialSignUp } from "@/lib/authBootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allowSignUp = await allowInitialSignUp();
    return NextResponse.json({ allowSignUp });
  } catch {
    // DB not migrated yet or unavailable — treat as closed sign-up for static analysis / CI.
    return NextResponse.json({ allowSignUp: false });
  }
}
