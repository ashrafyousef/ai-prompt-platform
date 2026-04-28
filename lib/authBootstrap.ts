import { db } from "@/lib/db";

/** Initial sign-up is allowed only before any workspace has an OWNER (bootstrap). */
export async function allowInitialSignUp(): Promise<boolean> {
  const ownerCount = await db.workspaceMember.count({
    where: { role: "OWNER", isActive: true },
  });
  return ownerCount === 0;
}
