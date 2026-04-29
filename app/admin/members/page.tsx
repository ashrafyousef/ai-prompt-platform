"use client";

import { useEffect, useMemo, useState } from "react";

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  isActive: boolean;
  teamId: string | null;
  teamName: string | null;
  joinedAt: string;
};

type Team = {
  id: string;
  name: string;
};

type Viewer = {
  userId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  platformRole: "USER" | "TEAM_LEAD" | "ADMIN" | null;
};

type Invitation = {
  id: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  teamName: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  invitedByName: string | null;
  invitedByEmail: string;
};

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"OWNER" | "ADMIN" | "MEMBER">("MEMBER");
  const [inviteTeamId, setInviteTeamId] = useState<string>("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [drafts, setDrafts] = useState<
    Record<string, { role: Member["role"]; isActive: boolean; teamId: string | null }>
  >({});

  const viewerIsOwner = viewer?.workspaceRole === "OWNER";
  const viewerIsAdmin = viewer?.workspaceRole === "ADMIN" || viewer?.platformRole === "ADMIN";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, teamsRes, invitationsRes] = await Promise.all([
        fetch("/api/admin/members"),
        fetch("/api/admin/teams"),
        fetch("/api/admin/invitations"),
      ]);
      const membersData = (await membersRes.json()) as {
        error?: string;
        viewer?: Viewer;
        members?: Member[];
      };
      const teamsData = (await teamsRes.json()) as {
        error?: string;
        teams?: Team[];
      };
      const invitationsData = (await invitationsRes.json()) as {
        error?: string;
        invitations?: Invitation[];
      };
      if (!membersRes.ok || !membersData.members || !membersData.viewer) {
        setError(membersData.error ?? "Failed to load members.");
        return;
      }
      if (!teamsRes.ok || !teamsData.teams) {
        setError(teamsData.error ?? "Failed to load teams.");
        return;
      }
      if (!invitationsRes.ok || !invitationsData.invitations) {
        setError(invitationsData.error ?? "Failed to load invitations.");
        return;
      }

      setViewer(membersData.viewer);
      setMembers(membersData.members);
      setTeams(teamsData.teams);
      setInvitations(invitationsData.invitations);
      setDrafts(
        Object.fromEntries(
          membersData.members.map((m) => [
            m.id,
            { role: m.role, isActive: m.isActive, teamId: m.teamId ?? null },
          ])
        )
      );
    } catch {
      setError("Failed to load members.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function canEditRole(member: Member): boolean {
    if (!viewer) return false;
    if (member.userId === viewer.userId) return false;
    if (viewerIsOwner) return true;
    return false;
  }

  function canEditMember(member: Member): boolean {
    if (!viewer) return false;
    if (member.userId === viewer.userId) return false;
    if (viewerIsOwner) return true;
    if (!viewerIsAdmin) return false;
    return member.role === "MEMBER";
  }

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.role !== b.role) {
          const rank = { OWNER: 0, ADMIN: 1, MEMBER: 2 } as const;
          return rank[a.role] - rank[b.role];
        }
        return a.email.localeCompare(b.email);
      }),
    [members]
  );

  async function saveMember(member: Member) {
    const draft = drafts[member.id];
    if (!draft) return;
    setSavingMemberId(member.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: draft.role,
          isActive: draft.isActive,
          teamId: draft.teamId,
        }),
      });
      const data = (await res.json()) as { error?: string; member?: Member };
      if (!res.ok || !data.member) {
        setError(data.error ?? "Failed to update member.");
        return;
      }
      setMembers((prev) => prev.map((m) => (m.id === data.member!.id ? data.member! : m)));
      setDrafts((prev) => ({
        ...prev,
        [data.member!.id]: {
          role: data.member!.role,
          isActive: data.member!.isActive,
          teamId: data.member!.teamId,
        },
      }));
    } catch {
      setError("Failed to update member.");
    } finally {
      setSavingMemberId(null);
    }
  }

  async function createInvite() {
    setInviteError(null);
    setInviteMessage(null);
    setInviteLink(null);
    if (!inviteEmail.trim()) {
      setInviteError("Invite email is required.");
      return;
    }
    setCreatingInvite(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          teamId: inviteTeamId || null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        inviteUrl?: string;
        invitation?: { id: string };
      };
      if (!res.ok && !data.invitation) {
        setInviteError(data.error ?? data.message ?? "Failed to create invitation.");
        return;
      }
      if (!res.ok) {
        setInviteError(data.message ?? "Invitation created, but delivery failed.");
      } else {
        setInviteMessage(data.message ?? "Invitation created.");
      }
      setInviteLink(data.inviteUrl ?? null);
      setInviteEmail("");
      setInviteRole("MEMBER");
      setInviteTeamId("");
      await load();
    } catch {
      setInviteError("Failed to create invitation.");
    } finally {
      setCreatingInvite(false);
    }
  }

  async function revokeInvite(invitationId: string) {
    setInviteError(null);
    const res = await fetch(`/api/admin/invitations/${invitationId}`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setInviteError(data.error ?? "Failed to revoke invitation.");
      return;
    }
    await load();
  }

  if (loading) {
    return <div className="py-10 text-sm text-zinc-500">Loading members...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Members</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage workspace members, role level, status, and team assignment with controlled rules.
        </p>
      </div>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      ) : null}
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Invite member</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Owners can invite OWNER/ADMIN/MEMBER. Admins can invite MEMBER only.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="member@example.com"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "OWNER" | "ADMIN" | "MEMBER")}
            disabled={!viewerIsOwner}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="OWNER">OWNER</option>
          </select>
          <select
            value={inviteTeamId}
            onChange={(e) => setInviteTeamId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">No team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void createInvite()}
            disabled={creatingInvite}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {creatingInvite ? "Creating..." : "Create invite"}
          </button>
        </div>
        {inviteError ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{inviteError}</p> : null}
        {inviteMessage ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{inviteMessage}</p> : null}
        {inviteLink ? (
          <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">Dev invite link: {inviteLink}</p>
        ) : null}
      </section>

      <section className="space-y-3 md:hidden">
        <h3 className="px-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Members</h3>
        {sortedMembers.map((member) => {
          const draft = drafts[member.id];
          const editable = canEditMember(member);
          return (
            <article
              key={`mobile-member-${member.id}`}
              className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="mb-2">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{member.name || "Unnamed user"}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{member.email}</p>
              </div>
              <div className="grid gap-2">
                <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Role</span>
                  <select
                    value={draft?.role ?? member.role}
                    disabled={!editable || !canEditRole(member)}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [member.id]: {
                          ...(prev[member.id] ?? {
                            role: member.role,
                            isActive: member.isActive,
                            teamId: member.teamId,
                          }),
                          role: e.target.value as Member["role"],
                        },
                      }))
                    }
                    className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="MEMBER">MEMBER</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Status</span>
                  <select
                    value={(draft?.isActive ?? member.isActive) ? "active" : "inactive"}
                    disabled={!editable}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [member.id]: {
                          ...(prev[member.id] ?? {
                            role: member.role,
                            isActive: member.isActive,
                            teamId: member.teamId,
                          }),
                          isActive: e.target.value === "active",
                        },
                      }))
                    }
                    className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Team</span>
                  <select
                    value={draft?.teamId ?? member.teamId ?? ""}
                    disabled={!editable}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [member.id]: {
                          ...(prev[member.id] ?? {
                            role: member.role,
                            isActive: member.isActive,
                            teamId: member.teamId,
                          }),
                          teamId: e.target.value || null,
                        },
                      }))
                    }
                    className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">No team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Joined{" "}
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                    new Date(member.joinedAt)
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => void saveMember(member)}
                  disabled={!editable || savingMemberId === member.id}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {savingMemberId === member.id ? "Saving..." : "Save"}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <div className="hidden overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:block">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
            {sortedMembers.map((member) => {
              const draft = drafts[member.id];
              const editable = canEditMember(member);
              return (
                <tr key={member.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {member.name || "Unnamed user"}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{member.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={draft?.role ?? member.role}
                      disabled={!editable || !canEditRole(member)}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [member.id]: {
                            ...(prev[member.id] ?? {
                              role: member.role,
                              isActive: member.isActive,
                              teamId: member.teamId,
                            }),
                            role: e.target.value as Member["role"],
                          },
                        }))
                      }
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="OWNER">OWNER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="MEMBER">MEMBER</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={(draft?.isActive ?? member.isActive) ? "active" : "inactive"}
                      disabled={!editable}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [member.id]: {
                            ...(prev[member.id] ?? {
                              role: member.role,
                              isActive: member.isActive,
                              teamId: member.teamId,
                            }),
                            isActive: e.target.value === "active",
                          },
                        }))
                      }
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={draft?.teamId ?? member.teamId ?? ""}
                      disabled={!editable}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [member.id]: {
                            ...(prev[member.id] ?? {
                              role: member.role,
                              isActive: member.isActive,
                              teamId: member.teamId,
                            }),
                            teamId: e.target.value || null,
                          },
                        }))
                      }
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="">No team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                      new Date(member.joinedAt)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void saveMember(member)}
                      disabled={!editable || savingMemberId === member.id}
                      className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {savingMemberId === member.id ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="space-y-3 md:hidden">
        <h3 className="px-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Invitations</h3>
        {invitations.length === 0 ? (
          <article className="rounded-2xl border border-zinc-200/80 bg-white p-3 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            No invitations yet.
          </article>
        ) : (
          invitations.map((inv) => {
            const status = inv.revokedAt
              ? "Revoked"
              : inv.acceptedAt
                ? "Accepted"
                : new Date(inv.expiresAt).getTime() <= Date.now()
                  ? "Expired"
                  : "Pending";
            const canRevoke = status === "Pending";
            return (
              <article
                key={`mobile-invite-${inv.id}`}
                className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{inv.email}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <p>Role: {inv.role}</p>
                  <p>Team: {inv.teamName ?? "None"}</p>
                  <p>Status: {status}</p>
                  <p>
                    Expires{" "}
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                      new Date(inv.expiresAt)
                    )}
                  </p>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={!canRevoke}
                    onClick={() => void revokeInvite(inv.id)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
                  >
                    Revoke
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="hidden overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:block">
        <div className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
          Invitations
        </div>
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
            {invitations.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-zinc-500 dark:text-zinc-400" colSpan={6}>
                  No invitations yet.
                </td>
              </tr>
            ) : (
              invitations.map((inv) => {
                const status = inv.revokedAt
                  ? "Revoked"
                  : inv.acceptedAt
                    ? "Accepted"
                    : new Date(inv.expiresAt).getTime() <= Date.now()
                      ? "Expired"
                      : "Pending";
                const canRevoke = status === "Pending";
                return (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{inv.email}</td>
                    <td className="px-4 py-3">{inv.role}</td>
                    <td className="px-4 py-3">{inv.teamName ?? "None"}</td>
                    <td className="px-4 py-3">{status}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                        new Date(inv.expiresAt)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={!canRevoke}
                        onClick={() => void revokeInvite(inv.id)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Owners can change roles and status. Admins can manage member status/team for MEMBER entries only. The last
        active owner cannot be removed or deactivated.
      </p>
    </div>
  );
}
