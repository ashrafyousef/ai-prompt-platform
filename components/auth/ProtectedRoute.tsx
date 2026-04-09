"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

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
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="mb-3 text-sm text-zinc-500">Sign in is required to access chat.</p>
        <button
          onClick={() => signIn("credentials", { email: "demo@example.com", callbackUrl: "/chat" })}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          Sign in as demo user
        </button>
      </div>
    </main>
  );
}
