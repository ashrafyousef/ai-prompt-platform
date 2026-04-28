"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";

type ValidationState = "loading" | "invalid" | "valid" | "expired" | "accepted" | "revoked";

type InviteDetails = {
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  workspaceName: string;
  expiresAt: string;
};

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [state, setState] = useState<ValidationState>("loading");
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    void (async () => {
      setState("loading");
      const res = await fetch(`/api/auth/invitations/validate?token=${encodeURIComponent(token)}`);
      const data = (await res.json()) as { state?: ValidationState; invitation?: InviteDetails };
      if (!res.ok && !data.state) {
        setState("invalid");
        return;
      }
      setState(data.state ?? "invalid");
      setInvite(data.invitation ?? null);
    })();
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (password.length > 0 || confirmPassword.length > 0) {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), password, confirmPassword }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to accept invitation.");
        return;
      }
      setSuccess("Invitation accepted. You can now sign in.");
      setState("accepted");
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") {
    return <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">Checking invitation...</div>;
  }

  if (state !== "valid") {
    const message =
      state === "expired"
        ? "This invitation has expired."
        : state === "accepted"
          ? "This invitation has already been used."
          : state === "revoked"
            ? "This invitation was revoked."
            : "This invitation link is invalid.";
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
        <p className="mt-6 text-sm">
          <Link href="/sign-in" className="text-violet-600 underline hover:text-violet-700 dark:text-violet-400">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-center text-xl font-semibold text-zinc-900 dark:text-zinc-100">Accept invitation</h1>
      <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Join <span className="font-medium">{invite?.workspaceName}</span> as <span className="font-medium">{invite?.role}</span>.
      </p>
      <p className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">Invited email: {invite?.email}</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Password (required for new accounts)
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving ? "Joining..." : "Accept invitation"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/sign-in" className="font-medium text-violet-600 underline hover:text-violet-700 dark:text-violet-400">
          Go to sign in
        </Link>
      </p>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          Loading...
        </div>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
