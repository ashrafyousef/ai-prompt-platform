"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = (await res.json()) as { message?: string };
      setMessage(
        data.message ??
          "If an account exists for that email, password reset instructions have been sent."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-center text-xl font-semibold text-zinc-900 dark:text-zinc-100">Forgot password</h1>
      <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Enter your email and we will send a reset link if an account exists.
      </p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
      {message ? <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">{message}</p> : null}
      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/sign-in" className="font-medium text-violet-600 underline hover:text-violet-700 dark:text-violet-400">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
