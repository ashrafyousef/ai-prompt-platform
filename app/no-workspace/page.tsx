import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { resolveWorkspaceAccessForUser } from "@/lib/workspaceAccess";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function NoWorkspacePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=%2Fchat");
  }

  const workspaceAccess = await resolveWorkspaceAccessForUser(session.user.id);
  if (workspaceAccess.hasWorkspaceMembership) {
    redirect("/chat");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-100 px-6 dark:from-zinc-950 dark:to-zinc-900">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Workspace access required</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your account is signed in, but it is not assigned to a workspace yet. Ask an administrator to add your
          account to a workspace before using chat or admin areas.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <SignOutButton
            callbackUrl="/sign-in"
            className="inline-flex rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Sign out
          </SignOutButton>
          <Link
            href="/chat"
            className="inline-flex rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Retry access
          </Link>
        </div>
      </div>
    </main>
  );
}
