"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import useSWR from "swr";
import { Bot, Images, Info, MessagesSquare, Sparkles } from "lucide-react";
import type { UiAgent, UiModelCapability, UiModelsResponse, UiSession } from "@/lib/types";
import { buildAgentModelExpectationLines } from "@/lib/chatAgentModelGuidance";
import { resolveModelById } from "@/lib/models";
import {
  COST_TIER_DISPLAY,
  MODEL_CAPABILITY_CHIP_SET,
  MODEL_CAPABILITY_LABELS,
  PROVIDER_DISPLAY,
} from "@/lib/modelUiLabels";

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

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{children}</p>;
}

const modelsFetcher = (url: string) => fetch(url).then((r) => r.json());

function formatSessionActivity(iso: string): string | null {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return null;
  }
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
  const { data: modelsData } = useSWR<UiModelsResponse>("/api/models", modelsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const governedModels = modelsData?.models ?? [];
  const expectationLines = buildAgentModelExpectationLines(agent, governedModels);

  const model = resolveModelById(selectedModelId);
  const activityLabel = session ? formatSessionActivity(session.updatedAt) : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 py-3">
      <header className="mb-3 border-b border-zinc-200/60 pb-3 dark:border-zinc-800/80">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">This conversation</h3>
        <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
          Who you are working with, which chat is open, what is attached, and which model will answer.
        </p>
      </header>

      <div className="space-y-2.5">
        <Section title="Agent" icon={Bot}>
          {agent ? (
            <>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-lg leading-none">{agent.icon || "🤖"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{agent.name}</p>
                  {agent.description?.trim() ? (
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {agent.description.trim()}
                    </p>
                  ) : (
                    <Muted>The publisher did not add a short description for this agent.</Muted>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {agent.category?.trim() ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {agent.category.trim()}
                  </span>
                ) : null}
                {typeof agent.knowledgeCount === "number" && agent.knowledgeCount > 0 ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {agent.knowledgeCount} knowledge source{agent.knowledgeCount === 1 ? "" : "s"}
                  </span>
                ) : null}
                {agent.availability ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {agent.availability === "GLOBAL" ? "Workspace-wide" : "Team only"}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <Muted>Select an assistant in the header to see its profile here.</Muted>
          )}
        </Section>

        <Section title="Session" icon={MessagesSquare}>
          {session ? (
            <div className="space-y-1.5">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" title={session.title}>
                {session.title || "Untitled chat"}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                {messageCount} message{messageCount === 1 ? "" : "s"}
                {activityLabel ? ` · Last activity ${activityLabel}` : null}
              </p>
            </div>
          ) : (
            <Muted>No session is open yet — your first send creates one and it will show here.</Muted>
          )}
        </Section>

        <Section title="Attachments in thread" icon={Images}>
          {attachmentUrls.length > 0 ? (
            <>
              <p className="mb-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                Thumbnails from image attachments in this chat (up to six).
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {attachmentUrls.slice(0, 6).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
                    <Image
                      src={url}
                      alt=""
                      width={400}
                      height={64}
                      unoptimized
                      className="h-16 w-full rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                    />
                  </a>
                ))}
              </div>
            </>
          ) : (
            <Muted>No images in this thread. Use the + control in the composer to add them when your model supports vision.</Muted>
          )}
        </Section>

        {expectationLines.length > 0 ? (
          <Section title="Model expectations" icon={Info}>
            <ul className="space-y-2">
              {expectationLines.map((line, i) => (
                <li key={i} className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {line}
                </li>
              ))}
            </ul>
            {agent?.modelPreferenceFallbackBehavior === "block" ? (
              <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-500">
                Mismatches are enforced strictly for this assistant when rules conflict.
              </p>
            ) : agent?.modelPreferenceFallbackBehavior === "warn" ? (
              <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-500">
                You may see warnings before sending if the model doesn’t fit; some checks stay soft.
              </p>
            ) : null}
          </Section>
        ) : null}

        <Section title="Model" icon={Sparkles}>
          {model ? (
            <>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{model.displayName}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{model.shortDescription}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {PROVIDER_DISPLAY[model.provider]}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {COST_TIER_DISPLAY[model.costTier]}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {model.capabilities
                  .filter((c): c is UiModelCapability => MODEL_CAPABILITY_CHIP_SET.has(c as UiModelCapability))
                  .map((capability) => (
                    <span
                      key={capability}
                      className="rounded-full bg-violet-100/80 px-2 py-0.5 text-[9px] font-medium text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
                    >
                      {MODEL_CAPABILITY_LABELS[capability]}
                    </span>
                  ))}
              </div>
            </>
          ) : (
            <Muted>Choose a model in the composer — details appear here for the curated list.</Muted>
          )}
        </Section>
      </div>
    </div>
  );
}
