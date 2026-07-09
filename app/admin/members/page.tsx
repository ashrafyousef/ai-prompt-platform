"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Input,
  PageHeader,
  PageShell,
  Panel,
  SectionStack,
  StatusChip,
  invitationStatusToChipStatus,
} from "@/components/ui";
import { uiTokens } from "@/lib/ui/tokens";
import { cn } from "@/lib/ui/cn";

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

function adminApiError(data: { error?: string; message?: string }, fallback: string): string {
  if (data.message) return data.message;
  return data.error ?? fallback;
}

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

function invitationStatus(inv: Invitation): string {
  if (inv.revokedAt) return "Revoked";
  if (inv.acceptedAt) return "Accepted";
  if (new Date(inv.expiresAt).getTime() <= Date.now()) return "Expired";
  return "Pending";
}

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
  const viewerIsPlatformAdmin = viewer?.platformRole === "ADMIN";
  const viewerIsAdmin = viewer?.workspaceRole === "ADMIN" || viewerIsPlatformAdmin;
  const canCrossAssignTeams = viewerIsOwner || viewerIsPlatformAdmin;
  const canChooseInviteRole = viewerIsOwner || viewerIsPlatformAdmin;

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
        message?: string;
        viewer?: Viewer;
        members?: Member[];
      };
      const teamsData = (await teamsRes.json()) as {
        error?: string;
        message?: string;
        teams?: Team[];
      };
      const invitationsData = (await invitationsRes.json()) as {
        error?: string;
        message?: string;
        invitations?: Invitation[];
      };
      if (!membersRes.ok || !membersData.members || !membersData.viewer) {
        setError(adminApiError(membersData, "Failed to load members."));
        return;
      }
      if (!teamsRes.ok || !teamsData.teams) {
        setError(adminApiError(teamsData, "Failed to load teams."));
        return;
      }
      if (!invitationsRes.ok || !invitationsData.invitations) {
        setError(adminApiError(invitationsData, "Failed to load invitations."));
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
    if (viewerIsOwner || viewerIsPlatformAdmin) return true;
    return false;
  }

  function canEditMember(member: Member): boolean {
    if (!viewer) return false;
    if (member.userId === viewer.userId) return false;
    if (viewerIsOwner || viewerIsPlatformAdmin) return true;
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
      const data = (await res.json()) as { error?: string; message?: string; member?: Member };
      if (!res.ok || !data.member) {
        setError(adminApiError(data, "Failed to update member."));
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
        setInviteError(adminApiError(data, "Failed to create invitation."));
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
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!res.ok) {
      setInviteError(adminApiError(data, "Failed to revoke invitation."));
      return;
    }
    await load();
  }

  if (loading) {
    return <div className="py-10 text-sm text-zinc-500">Loading members...</div>;
  }

  const selectClassName = cn("min-w-0", uiTokens.control.base, uiTokens.focusRing);

  return (
    <PageShell>
      <PageHeader
        title="Members"
        description="Manage workspace members, role level, status, and team assignment with controlled rules."
      />

      {error ? <div className={uiTokens.alert.danger}>{error}</div> : null}

      <Panel
        title="Invite member"
        description="Workspace owners or platform admins can invite OWNER/ADMIN/MEMBER. Team-scoped workspace admins can invite MEMBER only."
        padding="md"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="member@example.com"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "OWNER" | "ADMIN" | "MEMBER")}
            disabled={!canChooseInviteRole}
            className={selectClassName}
          >
            <option value="MEMBER">MEMBER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="OWNER">OWNER</option>
          </select>
          <select
            value={inviteTeamId}
            onChange={(e) => setInviteTeamId(e.target.value)}
            className={selectClassName}
          >
            {canCrossAssignTeams ? <option value="">No team</option> : null}
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <Button type="button" onClick={() => void createInvite()} disabled={creatingInvite} className="min-w-0">
            {creatingInvite ? "Creating..." : "Create invite"}
          </Button>
        </div>
        {inviteError ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{inviteError}</p> : null}
        {inviteMessage ? <p className={cn("mt-2", uiTokens.alert.success)}>{inviteMessage}</p> : null}
        {inviteLink ? (
          <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">Dev invite link: {inviteLink}</p>
        ) : null}
      </Panel>

      <SectionStack className="md:hidden">
        <h3 className="px-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Members</h3>
        {sortedMembers.map((member) => {
          const draft = drafts[member.id];
          const editable = canEditMember(member);
          return (
            <Card key={`mobile-member-${member.id}`} padding="sm">
              <div className="mb-2">
                <p className="break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {member.name || "Unnamed user"}
                </p>
                <p className="break-all text-xs text-zinc-500 dark:text-zinc-400">{member.email}</p>
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
                    className={cn(selectClassName, "px-2 py-2 text-xs")}
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
                    className={cn(selectClassName, "px-2 py-2 text-xs")}
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
                    className={cn(selectClassName, "px-2 py-2 text-xs")}
                  >
                    {canCrossAssignTeams ? <option value="">No team</option> : null}
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Joined{" "}
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                    new Date(member.joinedAt)
                  )}
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void saveMember(member)}
                  disabled={!editable || savingMemberId === member.id}
                >
                  {savingMemberId === member.id ? "Saving..." : "Save"}
                </Button>
              </div>
            </Card>
          );
        })}
      </SectionStack>

      <Card padding="none" className="hidden overflow-x-auto md:block">
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
                      className={cn(uiTokens.control.compact, uiTokens.focusRing)}
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
                      className={cn(uiTokens.control.compact, uiTokens.focusRing)}
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
                      className={cn(uiTokens.control.compact, uiTokens.focusRing)}
                    >
                      {canCrossAssignTeams ? <option value="">No team</option> : null}
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
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void saveMember(member)}
                      disabled={!editable || savingMemberId === member.id}
                    >
                      {savingMemberId === member.id ? "Saving..." : "Save"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <SectionStack className="md:hidden">
        <h3 className="px-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Invitations</h3>
        {invitations.length === 0 ? (
          <Card padding="sm" className="text-sm text-zinc-500 dark:text-zinc-400">
            No invitations yet.
          </Card>
        ) : (
          invitations.map((inv) => {
            const status = invitationStatus(inv);
            const canRevoke = status === "Pending";
            return (
              <Card key={`mobile-invite-${inv.id}`} padding="sm">
                <p className="break-all text-sm font-medium text-zinc-900 dark:text-zinc-100">{inv.email}</p>
                <div className="mt-2 grid gap-2 text-xs text-zinc-500 dark:text-zinc-400 min-[430px]:grid-cols-2">
                  <p>Role: {inv.role}</p>
                  <p>Team: {inv.teamName ?? "None"}</p>
                  <p className="flex items-center gap-2">
                    Status: <StatusChip status={invitationStatusToChipStatus(status)} label={status} />
                  </p>
                  <p>
                    Expires{" "}
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                      new Date(inv.expiresAt)
                    )}
                  </p>
                </div>
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canRevoke}
                    onClick={() => void revokeInvite(inv.id)}
                  >
                    Revoke
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </SectionStack>

      <Card padding="none" className="hidden overflow-x-auto md:block">
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
                const status = invitationStatus(inv);
                const canRevoke = status === "Pending";
                return (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{inv.email}</td>
                    <td className="px-4 py-3">{inv.role}</td>
                    <td className="px-4 py-3">{inv.teamName ?? "None"}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={invitationStatusToChipStatus(status)} label={status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                        new Date(inv.expiresAt)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canRevoke}
                        onClick={() => void revokeInvite(inv.id)}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Owners can change roles and status. Admins can manage member status/team for MEMBER entries only. The last
        active owner cannot be removed or deactivated.
      </p>
    </PageShell>
  );
}
