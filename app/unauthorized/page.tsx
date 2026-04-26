import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-100 px-6 dark:from-zinc-950 dark:to-zinc-900">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Access denied</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          You don’t have permission to view this area. Access is limited to authorized workspace managers.
        </p>
        <Link
          href="/chat"
          className="mt-6 inline-flex rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Back to chat
        </Link>
      </div>
    </main>
  );
}
