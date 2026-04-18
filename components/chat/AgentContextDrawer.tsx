"use client";

import type { ReactNode } from "react";
import { Bot, Images, MessagesSquare, Orbit, Sparkles } from "lucide-react";
import type { UiAgent, UiSession } from "@/lib/types";
import { resolveModelById } from "@/lib/models";

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Bot;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200/70 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </section>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="text-xs text-zinc-400 dark:text-zinc-500">{text}</p>;
}

export function AgentContextDrawer({
  agent,
  session,
  messageCount,
  attachmentUrls,
  selectedModelId,
}: {
  agent: UiAgent | undefined;
  session: UiSession | undefined;
  messageCount: number;
  attachmentUrls: string[];
  selectedModelId: string;
}) {
  const model = resolveModelById(selectedModelId);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 py-3">
      <div className="mb-3 px-1">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Conversation Context</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Active context for this chat.
        </p>
      </div>

      <div className="space-y-2.5">
        <Section title="Agent" icon={Bot}>
          {agent ? (
            <>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-lg leading-none">{agent.icon || "🤖"}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{agent.name}</p>
                  {agent.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{agent.description}</p>
                  ) : (
                    <EmptyLine text="No agent summary available yet." />
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {agent.category ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {agent.category}
                  </span>
                ) : null}
                {typeof agent.knowledgeCount === "number" ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {agent.knowledgeCount} knowledge source{agent.knowledgeCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <EmptyLine text="No agent selected." />
          )}
        </Section>

        <Section title="Session" icon={MessagesSquare}>
          {session ? (
            <div className="space-y-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{session.title}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {messageCount} message{messageCount === 1 ? "" : "s"} in this conversation
              </p>
            </div>
          ) : (
            <EmptyLine text="Start a chat to see session details." />
          )}
        </Section>

        <Section title="Attachments" icon={Images}>
          {attachmentUrls.length > 0 ? (
            <>
              <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                {attachmentUrls.length} image attachment{attachmentUrls.length === 1 ? "" : "s"} in this chat
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {attachmentUrls.slice(0, 6).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={url}
                      alt="Chat attachment"
                      className="h-16 w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                    />
                  </a>
                ))}
              </div>
            </>
          ) : (
            <EmptyLine text="No attachments in this conversation yet." />
          )}
        </Section>

        <Section title="Model" icon={Sparkles}>
          {model ? (
            <>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{model.displayName}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{model.shortDescription}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {model.provider}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {model.costTier}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {model.capabilities.includes("vision") ? "Vision" : "Text"}
                </span>
              </div>
            </>
          ) : (
            <EmptyLine text="Model details are unavailable for this selection." />
          )}
        </Section>

        <Section title="Sources" icon={Orbit}>
          <EmptyLine text="Retrieval source context will appear here once source tracing is enabled." />
        </Section>
      </div>
    </div>
  );
}
