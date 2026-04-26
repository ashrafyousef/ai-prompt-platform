"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type ProfileResponse = {
  profile: {
    name: string;
    email: string;
    workspaceName: string;
    workspaceRole: "OWNER" | "ADMIN" | "MEMBER";
    platformRole: "USER" | "TEAM_LEAD" | "ADMIN";
    teamName: string | null;
  };
};

export default function ProfilePage() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceRole, setWorkspaceRole] = useState("");
  const [platformRole, setPlatformRole] = useState("");
  const [teamName, setTeamName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/account/profile");
        const data = (await res.json()) as ProfileResponse & { error?: string };
        if (!res.ok || !data.profile) {
          setError(data.error ?? "Unable to load profile.");
          return;
        }
        setName(data.profile.name ?? "");
        setEmail(data.profile.email ?? "");
        setWorkspaceName(data.profile.workspaceName ?? "");
        setWorkspaceRole(data.profile.workspaceRole ?? "");
        setPlatformRole(data.profile.platformRole ?? "");
        setTeamName(data.profile.teamName ?? null);
      } catch {
        setError("Unable to load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  async function onSaveName(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameMessage(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { profile?: { name?: string }; error?: string };
      if (!res.ok) {
        setNameMessage(data.error ?? "Failed to save profile.");
        return;
      }
      setName(data.profile?.name ?? name);
      setNameMessage("Profile updated.");
    } finally {
      setSavingName(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password must match.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setPasswordError(data.error ?? "Failed to change password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password changed successfully.");
    } finally {
      setSavingPassword(false);
    }
  }

  if (status === "loading" || loading) {
    return <main className="mx-auto max-w-3xl p-6 text-sm text-zinc-500">Loading account...</main>;
  }

  if (status !== "authenticated") {
    return (
      <main className="mx-auto max-w-3xl p-6 text-sm">
        Sign in is required.{" "}
        <Link href="/sign-in?callbackUrl=%2Fprofile" className="text-violet-600 underline dark:text-violet-400">
          Go to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Account</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Review your account identity and workspace access context.
        </p>
        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="grid gap-1">
            <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{email}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-zinc-500 dark:text-zinc-400">Workspace</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{workspaceName}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-zinc-500 dark:text-zinc-400">Workspace role</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{workspaceRole}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-zinc-500 dark:text-zinc-400">Platform role</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{platformRole}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-zinc-500 dark:text-zinc-400">Team</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{teamName ?? "None"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Profile</h2>
        <form className="mt-4 space-y-3" onSubmit={onSaveName}>
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Display name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={savingName}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {savingName ? "Saving..." : "Save profile"}
          </button>
          {nameMessage ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{nameMessage}</p> : null}
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Change password</h2>
        <form className="mt-4 space-y-3" onSubmit={onChangePassword}>
          <div>
            <label htmlFor="currentPassword" className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {savingPassword ? "Updating..." : "Update password"}
          </button>
          {passwordError ? <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p> : null}
          {passwordMessage ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{passwordMessage}</p> : null}
        </form>
      </section>
    </main>
  );
}
