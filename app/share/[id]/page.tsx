import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { db } from "@/lib/db";

type Props = {
  params: { id: string };
  searchParams: { token?: string };
};

export default async function SharePage({ params, searchParams }: Props) {
  const token = searchParams.token;
  if (!token) notFound();

  const share = await db.sharedChat.findFirst({
    where: {
      id: params.id,
      token,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      session: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!share) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">{share.session.title}</h1>
      <p className="mt-1 text-xs text-zinc-500">Read-only shared conversation</p>
      <div className="mt-6 space-y-4">
        {share.session.messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-xl border p-4 ${
              message.role === "user" ? "border-violet-200 bg-violet-50" : "border-zinc-200 bg-white"
            }`}
          >
            <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">{message.role}</p>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </article>
        ))}
      </div>
    </main>
  );
}
