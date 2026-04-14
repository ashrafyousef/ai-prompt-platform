import { getAdminSessionOrRedirect } from "@/lib/adminAuth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  await getAdminSessionOrRedirect();
  return <AdminShell>{children}</AdminShell>;
}
