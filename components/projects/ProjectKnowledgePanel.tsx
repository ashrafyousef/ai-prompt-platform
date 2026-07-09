import { Panel } from "@/components/ui";

export function ProjectKnowledgePanel() {
  return (
    <Panel
      title="Knowledge Context"
      description="How confirmed knowledge will support this project in later phases."
      padding="md"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        In later phases, this project will be able to use confirmed project memory, client knowledge,
        brand rules, uploaded files, and agency knowledge.
      </p>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        For now, project chats remain linked to this project, but AI responses are not automatically
        using project memory.
      </p>
    </Panel>
  );
}
