import { getAdminSessionOrRedirect } from "@/lib/adminAuth";

/**
 * Phase 4A: same database-backed manager gate as Admin.
 * JWT middleware alone is not sufficient — revalidate membership/role from the DB.
 */
export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getAdminSessionOrRedirect();
  return children;
}
