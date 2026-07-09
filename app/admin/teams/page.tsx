"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Input,
  PageHeader,
  PageShell,
  Panel,
  SectionStack,
  StatusChip,
} from "@/components/ui";
import { uiTokens } from "@/lib/ui/tokens";

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  isArchived: boolean;
  memberCount: number;
};

type Viewer = {
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  platformRole: "USER" | "TEAM_LEAD" | "ADMIN" | null;
};

function adminApiError(data: { error?: string; message?: string }, fallback: string): string {
  if (data.message) return data.message;
  return data.error ?? fallback;
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<Record<string, string>>({});

  const viewerCanManageTeams =
    viewer?.workspaceRole === "OWNER" || viewer?.platformRole === "ADMIN";

  async function load() {
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const res = await fetch("/api/admin/teams");
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        viewer?: Viewer;
        teams?: TeamRow[];
      };
      if (!res.ok || !data.teams) {
        setError(adminApiError(data, "Failed to load teams."));
        setLoadFailed(true);
        return;
      }
      setViewer(data.viewer ?? null);
      setTeams(data.teams);
      setDraftName(Object.fromEntries(data.teams.map((t) => [t.id, t.name])));
    } catch {
      setError("Failed to load teams.");
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeTeams = useMemo(() => teams.filter((t) => !t.isArchived), [teams]);
  const archivedTeams = useMemo(() => teams.filter((t) => t.isArchived), [teams]);
  const orderedTeams = useMemo(() => [...activeTeams, ...archivedTeams], [activeTeams, archivedTeams]);

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
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(adminApiError(data, "Failed to create team."));
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
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(adminApiError(data, "Failed to update team."));
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

  if (loadFailed) {
    return (
      <PageShell>
        <PageHeader
          title="Teams"
          description="Manage workspace teams and prepare team-scoped boundaries for agents and member access."
        />
        <div className={uiTokens.alert.danger}>{error}</div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Teams"
        description="Manage workspace teams and prepare team-scoped boundaries for agents and member access."
      />

      {error ? <div className={uiTokens.alert.danger}>{error}</div> : null}

      {viewerCanManageTeams ? (
        <Panel title="Create team" padding="md">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onCreateTeam}>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Team name"
            />
            <Button type="submit" disabled={creating} className="sm:self-start">
              {creating ? "Creating..." : "Create"}
            </Button>
          </form>
        </Panel>
      ) : null}

      <SectionStack className="md:hidden">
        <h3 className="px-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Workspace teams</h3>
        {orderedTeams.length === 0 ? (
          <Card padding="md" className="text-sm text-zinc-500 dark:text-zinc-400">
            No teams yet.
          </Card>
        ) : (
          orderedTeams.map((team) => (
            <Card key={`mobile-team-${team.id}`} padding="sm">
              <Input
                label="Team name"
                value={draftName[team.id] ?? team.name}
                onChange={(e) => setDraftName((prev) => ({ ...prev, [team.id]: e.target.value }))}
                disabled={team.isArchived}
                className="font-medium"
              />
              <div className="mt-3 grid gap-2 text-xs text-zinc-500 dark:text-zinc-400 min-[430px]:grid-cols-2">
                <p className="min-w-0">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Slug:</span>{" "}
                  <span className="break-all">{team.slug}</span>
                </p>
                <p>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Members:</span>{" "}
                  {team.memberCount}
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Status:</span>
                  <StatusChip status={team.isArchived ? "archived" : "active"} />
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void saveTeam(team.id, { name: (draftName[team.id] ?? team.name).trim() })}
                  disabled={savingId === team.id || team.isArchived}
                >
                  Save name
                </Button>
                {viewerCanManageTeams ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void saveTeam(team.id, { isArchived: !team.isArchived })}
                    disabled={savingId === team.id}
                  >
                    {team.isArchived ? "Restore" : "Archive"}
                  </Button>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </SectionStack>

      <Card padding="none" className="hidden overflow-x-auto md:block">
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
            {orderedTeams.map((team) => (
              <tr key={team.id}>
                <td className="px-4 py-3">
                  <Input
                    value={draftName[team.id] ?? team.name}
                    onChange={(e) => setDraftName((prev) => ({ ...prev, [team.id]: e.target.value }))}
                    disabled={team.isArchived}
                    className="px-2 py-1"
                  />
                </td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{team.slug}</td>
                <td className="px-4 py-3">{team.memberCount}</td>
                <td className="px-4 py-3">
                  <StatusChip status={team.isArchived ? "archived" : "active"} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void saveTeam(team.id, { name: (draftName[team.id] ?? team.name).trim() })}
                      disabled={savingId === team.id || team.isArchived}
                    >
                      Save name
                    </Button>
                    {viewerCanManageTeams ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveTeam(team.id, { isArchived: !team.isArchived })}
                        disabled={savingId === team.id}
                      >
                        {team.isArchived ? "Restore" : "Archive"}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Scoped access rule in this phase: workspace admins are constrained to their own team scope for member and invite
        management, while owners and platform admins keep full workspace visibility.
      </p>
    </PageShell>
  );
}
