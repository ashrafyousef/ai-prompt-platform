"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  classifyProjectTeamAssignments,
  formatInvalidAssignmentLabel,
  getProjectAssignmentEditorPolicy,
  initialEditableTeamIds,
  invalidAssignmentWarning,
  selectableTeamsForEditor,
  toggleEditableTeamId,
  type ProjectAssignmentViewer,
} from "@/lib/adminProjectTeamEditor";

type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; slug: string } | null;
  teams: Array<{ id: string; name: string; slug: string }>;
};

type ClientOption = {
  id: string;
  name: string;
  slug: string;
};

type TeamOption = {
  id: string;
  name: string;
  slug: string;
  isArchived: boolean;
};

function adminApiError(data: { error?: string; message?: string }, fallback: string): string {
  if (data.message) return data.message;
  return data.error ?? fallback;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTeams(teams: ProjectRow["teams"]): string {
  if (teams.length === 0) return "—";
  return teams.map((t) => t.name).join(", ");
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [viewer, setViewer] = useState<ProjectAssignmentViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createClientId, setCreateClientId] = useState("");
  const [createStatus, setCreateStatus] = useState<ProjectStatus>("DRAFT");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editTeamIds, setEditTeamIds] = useState<string[]>([]);
  const [savingTeams, setSavingTeams] = useState(false);

  const activeTeams = useMemo(() => teams.filter((t) => !t.isArchived), [teams]);
  const policy = useMemo(
    () =>
      getProjectAssignmentEditorPolicy(
        viewer ?? { workspaceRole: null, platformRole: null, teamId: null }
      ),
    [viewer]
  );

  async function load() {
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const [projectsRes, clientsRes] = await Promise.all([
        fetch("/api/admin/projects"),
        fetch("/api/admin/clients"),
      ]);
      const projectsData = (await projectsRes.json()) as {
        error?: string;
        message?: string;
        projects?: ProjectRow[];
        viewer?: ProjectAssignmentViewer;
        assignmentTeams?: TeamOption[];
      };
      const clientsData = (await clientsRes.json()) as {
        error?: string;
        message?: string;
        clients?: ClientOption[];
      };

      if (projectsRes.status === 403) {
        setError(projectsData.message ?? projectsData.error ?? "You are not authorized to view projects.");
        setLoadFailed(true);
        return;
      }
      if (!projectsRes.ok || !projectsData.projects || !projectsData.assignmentTeams) {
        setError(adminApiError(projectsData, "Failed to load projects."));
        setLoadFailed(true);
        return;
      }
      if (!clientsRes.ok || !clientsData.clients) {
        setError(adminApiError(clientsData, "Failed to load clients for project form."));
        setLoadFailed(true);
        return;
      }

      setProjects(projectsData.projects);
      setClients(clientsData.clients);
      setTeams(projectsData.assignmentTeams);
      setViewer(projectsData.viewer ?? null);
    } catch {
      setError("Failed to load projects.");
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleTeam(teamId: string) {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  }

  function startEditTeams(project: ProjectRow) {
    const classified = classifyProjectTeamAssignments(project.teams, teams);
    setEditingProjectId(project.id);
    setEditTeamIds(initialEditableTeamIds(classified, policy));
    setError(null);
    setSuccessMessage(null);
  }

  function cancelEditTeams() {
    setEditingProjectId(null);
    setEditTeamIds([]);
  }

  async function saveProjectTeams(projectId: string) {
    setSavingTeams(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamIds: editTeamIds }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        project?: ProjectRow;
      };
      if (!res.ok) {
        // Keep editor open and preserve last confirmed projects[] + current draft selection.
        setError(adminApiError(data, "Failed to update project teams."));
        return;
      }
      setEditingProjectId(null);
      setEditTeamIds([]);
      setSuccessMessage("Project teams updated.");
      await load();
    } catch {
      setError("Failed to update project teams.");
    } finally {
      setSavingTeams(false);
    }
  }

  function renderTeamEditor(project: ProjectRow) {
    const classified = classifyProjectTeamAssignments(project.teams, teams);
    const warning = invalidAssignmentWarning(classified.invalid);
    const selectable = selectableTeamsForEditor(activeTeams, policy);

    if (editingProjectId !== project.id) {
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span>{formatTeams(project.teams)}</span>
            <button
              type="button"
              onClick={() => startEditTeams(project)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Edit teams
            </button>
          </div>
          {warning ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">{warning}</p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {warning ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <p>{warning}</p>
            <ul className="mt-1 list-disc pl-4">
              {classified.invalid.map((team) => (
                <li key={`${project.id}-invalid-${team.id}`}>{formatInvalidAssignmentLabel(team)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {selectable.length === 0 ? (
          <p className="text-xs text-zinc-500">No active teams available.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectable.map((team) => {
              const locked =
                policy.mode === "own-team-only" && policy.ownTeamId === team.id;
              return (
                <label
                  key={`${project.id}-${team.id}`}
                  className="flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700"
                >
                  <input
                    type="checkbox"
                    checked={editTeamIds.includes(team.id)}
                    disabled={locked}
                    onChange={() =>
                      setEditTeamIds((prev) => toggleEditableTeamId(prev, team.id, policy))
                    }
                    className="rounded border-zinc-300 dark:border-zinc-600"
                  />
                  {team.name}
                  {locked ? " (required)" : ""}
                </label>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={savingTeams}
            onClick={() => void saveProjectTeams(project.id)}
            className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {savingTeams ? "Saving..." : "Save teams"}
          </button>
          <button
            type="button"
            disabled={savingTeams}
            onClick={cancelEditTeams}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
          >
            Cancel
          </button>
        </div>

        {policy.mode === "own-team-only" ? (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Your assigned team must remain attached to this project. Saving replaces other
            assignments with your team.
          </p>
        ) : (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Saving replaces all team assignments. Clear all boxes to leave the project unassigned
            (manager-only).
          </p>
        )}
      </div>
    );
  }

  async function onCreateProject(e: FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const payload: {
        name: string;
        slug?: string;
        clientId?: string | null;
        status: ProjectStatus;
        teamIds?: string[];
      } = {
        name: createName.trim(),
        status: createStatus,
      };
      if (createSlug.trim()) payload.slug = createSlug.trim().toLowerCase();
      if (createClientId) payload.clientId = createClientId;
      if (selectedTeamIds.length > 0) payload.teamIds = selectedTeamIds;

      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(adminApiError(data, "Failed to create project."));
        return;
      }
      setCreateName("");
      setCreateSlug("");
      setCreateClientId("");
      setCreateStatus("DRAFT");
      setSelectedTeamIds([]);
      setSuccessMessage("Project created.");
      await load();
    } catch {
      setError("Failed to create project.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="py-10 text-sm text-zinc-500">Loading projects...</div>;
  }

  if (loadFailed) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Projects</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Workspace project records for future Brief Intake.
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Projects</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Create projects and manage team assignments. Open a project to continue work in its
          workspace.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
          {successMessage}
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Create project</h3>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={onCreateProject}>
          <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Name</span>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="ABK Summer Campaign"
              required
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Slug (optional)</span>
            <input
              value={createSlug}
              onChange={(e) => setCreateSlug(e.target.value)}
              placeholder="abk-summer-campaign"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Client (optional)</span>
            <select
              value={createClientId}
              onChange={(e) => setCreateClientId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">No client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Status</span>
            <select
              value={createStatus}
              onChange={(e) => setCreateStatus(e.target.value as ProjectStatus)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          {activeTeams.length > 0 ? (
            <fieldset className="sm:col-span-2">
              <legend className="text-xs text-zinc-500 dark:text-zinc-400">Teams (optional)</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {activeTeams.map((team) => (
                  <label
                    key={team.id}
                    className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.includes(team.id)}
                      onChange={() => toggleTeam(team.id)}
                      className="rounded border-zinc-300 dark:border-zinc-600"
                    />
                    {team.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {creating ? "Creating..." : "Create project"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3 md:hidden">
        <h3 className="px-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Workspace projects</h3>
        {projects.length === 0 ? (
          <article className="rounded-2xl border border-zinc-200/80 bg-white p-4 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            No projects yet. Use the form above to create your first project.
          </article>
        ) : (
          projects.map((project) => (
            <article
              key={`mobile-project-${project.id}`}
              className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <Link
                href={`/projects/${project.id}`}
                className="text-sm font-medium text-zinc-900 hover:text-violet-700 dark:text-zinc-100 dark:hover:text-violet-400"
              >
                {project.name}
              </Link>
              <div className="mt-2 grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <p>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Slug:</span>{" "}
                  <span className="break-all">{project.slug}</span>
                </p>
                <p>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Status:</span> {project.status}
                </p>
                <p>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Client:</span>{" "}
                  {project.client?.name ?? "—"}
                </p>
                <p>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Teams:</span>
                </p>
                <div className="text-xs text-zinc-600 dark:text-zinc-300">{renderTeamEditor(project)}</div>
                <p>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Updated:</span>{" "}
                  {formatDate(project.updatedAt)}
                </p>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="hidden overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:block">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Teams</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  No projects yet. Use the form above to create your first project.
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    <Link
                      href={`/projects/${project.id}`}
                      className="hover:text-violet-700 dark:hover:text-violet-400"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{project.slug}</td>
                  <td className="px-4 py-3">{project.status}</td>
                  <td className="px-4 py-3">{project.client?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{renderTeamEditor(project)}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{formatDate(project.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
