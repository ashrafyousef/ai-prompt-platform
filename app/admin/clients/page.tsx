"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ClientRow = {
  id: string;
  name: string;
  slug: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  projectCount: number;
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

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const res = await fetch("/api/admin/clients");
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        clients?: ClientRow[];
      };
      if (res.status === 403) {
        setError(data.message ?? data.error ?? "You are not authorized to view clients.");
        setLoadFailed(true);
        return;
      }
      if (!res.ok || !data.clients) {
        setError(adminApiError(data, "Failed to load clients."));
        setLoadFailed(true);
        return;
      }
      setClients(data.clients);
    } catch {
      setError("Failed to load clients.");
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const orderedClients = useMemo(() => {
    const active = clients.filter((c) => !c.isArchived);
    const archived = clients.filter((c) => c.isArchived);
    return [...active, ...archived];
  }, [clients]);

  async function onCreateClient(e: FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const payload: { name: string; slug?: string } = { name: createName.trim() };
      if (createSlug.trim()) payload.slug = createSlug.trim().toLowerCase();
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(adminApiError(data, "Failed to create client."));
        return;
      }
      setCreateName("");
      setCreateSlug("");
      setSuccessMessage("Client created.");
      await load();
    } catch {
      setError("Failed to create client.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="py-10 text-sm text-zinc-500">Loading clients...</div>;
  }

  if (loadFailed) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Clients</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Workspace client records used for project organization.
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
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Clients</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Workspace client records used for project organization.
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
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Create client</h3>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={onCreateClient}>
          <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Name</span>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="ABK"
              required
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Slug (optional)</span>
            <input
              value={createSlug}
              onChange={(e) => setCreateSlug(e.target.value)}
              placeholder="abk"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {creating ? "Creating..." : "Create client"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3 md:hidden">
        <h3 className="px-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Workspace clients</h3>
        {orderedClients.length === 0 ? (
          <article className="rounded-2xl border border-zinc-200/80 bg-white p-4 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            No clients yet. Use the form above to create your first client.
          </article>
        ) : (
          orderedClients.map((client) => (
            <article
              key={`mobile-client-${client.id}`}
              className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{client.name}</p>
              <div className="mt-2 grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <p>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Slug:</span>{" "}
                  <span className="break-all">{client.slug}</span>
                </p>
                <p>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Projects:</span>{" "}
                  {client.projectCount}
                </p>
                <p>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Status:</span>{" "}
                  {client.isArchived ? "Archived" : "Active"}
                </p>
                <p>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Updated:</span>{" "}
                  {formatDate(client.updatedAt)}
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
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Projects</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
            {orderedClients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  No clients yet. Use the form above to create your first client.
                </td>
              </tr>
            ) : (
              orderedClients.map((client) => (
                <tr key={client.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{client.name}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{client.slug}</td>
                  <td className="px-4 py-3">{client.projectCount}</td>
                  <td className="px-4 py-3">{client.isArchived ? "Archived" : "Active"}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{formatDate(client.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
