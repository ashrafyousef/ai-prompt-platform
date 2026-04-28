/**
 * URL-safe slug for Workspace; caller must ensure uniqueness (e.g. append short id).
 */
export function slugifyWorkspaceName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length > 0 ? base : "workspace";
}
