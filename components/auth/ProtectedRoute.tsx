"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status !== "loading") {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  if (status === "authenticated") return <>{children}</>;

  if (status === "loading" && !timedOut) {
    return <main className="p-6 text-sm text-zinc-500">Checking session...</main>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="text-center">
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">Sign in is required to access chat.</p>
        <Link
          href="/sign-in?callbackUrl=%2Fchat"
          className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Go to sign in
        </Link>
      </div>
    </main>
  );
}
