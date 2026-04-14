import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function isDatabaseUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("prismaclientinitializationerror") ||
    message.includes("timed out")
  );
}

export async function getAdminSessionOrRedirect() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/chat?callbackUrl=/admin");
  }
  let user: { role: "USER" | "TEAM_LEAD" | "ADMIN" } | null = null;
  try {
    user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      redirect("/chat?error=service-unavailable");
    }
    throw error;
  }
  if (user?.role !== "ADMIN") {
    redirect("/unauthorized");
  }
  return { session, userId: session.user.id as string };
}

export async function requireAdminUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  let user: { role: "USER" | "TEAM_LEAD" | "ADMIN" } | null = null;
  try {
    user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      throw new Error("ServiceUnavailable");
    }
    throw error;
  }
  if (user?.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return session.user.id;
}
