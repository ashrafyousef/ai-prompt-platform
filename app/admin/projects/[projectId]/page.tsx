import { redirect } from "next/navigation";

/** Day-to-day project workspace lives at /projects/[projectId]. */
export default function AdminProjectDetailRedirect({
  params,
}: {
  params: { projectId: string };
}) {
  redirect(`/projects/${encodeURIComponent(params.projectId)}`);
}
