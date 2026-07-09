import { Badge, Panel } from "@/components/ui";

const availableNow = ["Project chats", "Briefs", "Strategy direction"] as const;

const plannedLater = [
  "Confirmed project memory",
  "Uploaded references",
  "Client / brand knowledge",
  "Agency knowledge",
] as const;

export function ProjectContextPanel() {
  return (
    <Panel
      title="Project Context"
      description="What context exists for this project today, and what is planned next."
      padding="md"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        This workspace brings together the project&apos;s chats, briefs, strategy direction, and future
        confirmed memory.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Available now
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableNow.map((item) => (
              <Badge key={item} variant="success" size="md">
                {item}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Planned later
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {plannedLater.map((item) => (
              <Badge key={item} variant="neutral" size="md">
                {item}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            These capabilities are not active yet. Project chats are linked to this project, but AI
            responses do not automatically use project memory.
          </p>
        </div>
      </div>
    </Panel>
  );
}
