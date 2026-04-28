"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  isArchived: boolean;
  memberCount: number;
};

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/teams");
      const data = (await res.json()) as { error?: string; teams?: TeamRow[] };
      if (!res.ok || !data.teams) {
        setError(data.error ?? "Failed to load teams.");
        return;
      }
      setTeams(data.teams);
      setDraftName(Object.fromEntries(data.teams.map((t) => [t.id, t.name])));
    } catch {
      setError("Failed to load teams.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeTeams = useMemo(() => teams.filter((t) => !t.isArchived), [teams]);
  const archivedTeams = useMemo(() => teams.filter((t) => t.isArchived), [teams]);

  async function onCreateTeam(e: FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create team.");
        return;
      }
      setCreateName("");
      await load();
    } catch {
      setError("Failed to create team.");
    } finally {
      setCreating(false);
    }
  }

  async function saveTeam(teamId: string, next: { name?: string; isArchived?: boolean }) {
    setSavingId(teamId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to update team.");
        return;
      }
      await load();
    } catch {
      setError("Failed to update team.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <div className="py-10 text-sm text-zinc-500">Loading teams...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Teams</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage workspace teams and prepare team-scoped boundaries for agents and member access.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Create team</h3>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={onCreateTeam}>
          <input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Team name"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </form>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
            {[...activeTeams, ...archivedTeams].map((team) => (
              <tr key={team.id}>
                <td className="px-4 py-3">
                  <input
                    value={draftName[team.id] ?? team.name}
                    onChange={(e) => setDraftName((prev) => ({ ...prev, [team.id]: e.target.value }))}
                    disabled={team.isArchived}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{team.slug}</td>
                <td className="px-4 py-3">{team.memberCount}</td>
                <td className="px-4 py-3">{team.isArchived ? "Archived" : "Active"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void saveTeam(team.id, { name: (draftName[team.id] ?? team.name).trim() })}
                      disabled={savingId === team.id || team.isArchived}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-60 dark:border-zinc-700"
                    >
                      Save name
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveTeam(team.id, { isArchived: !team.isArchived })}
                      disabled={savingId === team.id}
                      className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {team.isArchived ? "Restore" : "Archive"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Scoped access rule in this phase: workspace admins are constrained to their own team scope for member and invite
        management, while owners keep full workspace visibility.
      </p>
    </div>
  );
}
