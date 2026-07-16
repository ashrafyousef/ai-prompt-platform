import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readSource(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

describe("MEMBER read-only project detail UI (Phase 4B.2)", () => {
  it("fetches only GET /api/projects/<id> in MemberProjectDetailPage", () => {
    const source = readSource("components/projects/MemberProjectDetailPage.tsx");
    expect(source).toContain("`/api/projects/${encodeURIComponent(projectId)}`");
    expect(source).not.toContain("/api/admin/projects");
    expect(source).not.toContain("/api/admin/briefs");
    expect(source).not.toContain("/api/admin/strategies");
    expect(source).not.toContain("/api/chat/new");
    expect(source).not.toContain("/chats");
  });

  it("shows read-only access via ProjectWorkspaceHeader readOnly prop", () => {
    const detail = readSource("components/projects/MemberProjectDetailPage.tsx");
    expect(detail).toContain("readOnly");
    const header = readSource("components/projects/ProjectWorkspaceHeader.tsx");
    expect(header).toContain("Read-only access");
    expect(header).toMatch(/readOnly[\s\S]*New project chat/);
  });

  it("renders read-only brief fields and empty state without mutation controls", () => {
    const source = readSource("components/projects/MemberProjectBriefSection.tsx");
    expect(source).toContain("BRIEF_INTAKE_FIELD_DEFINITIONS");
    expect(source).toContain("No brief has been added to this project yet.");
    expect(source).toContain("document.source.rawText");
    expect(source).toContain("document.analysis");
    expect(source).not.toContain("textarea");
    expect(source).not.toContain("Analyze brief");
    expect(source).not.toContain("Submit brief");
    expect(source).not.toContain("Approve brief");
  });

  it("renders read-only strategy groups and empty state without mutation controls", () => {
    const source = readSource("components/projects/MemberProjectStrategySection.tsx");
    expect(source).toContain("STRATEGY_FIELD_DEFINITIONS");
    expect(source).toContain("No strategy direction has been added to this project yet.");
    expect(source).not.toContain("textarea");
    expect(source).not.toContain("Mark Ready");
    expect(source).not.toContain("/api/admin/strategies");
  });

  it("side rail excludes chats and mutation prompts", () => {
    const source = readSource("components/projects/MemberProjectSideRail.tsx");
    expect(source).toContain("Read-only");
    expect(source).toContain("ProjectKnowledgePanel");
    expect(source).toContain("Files / References");
    expect(source).not.toContain("ProjectChatsPanel");
    expect(source).not.toContain("New project chat");
    expect(source).not.toContain("/api/chat");
  });

  it("ProjectAccessProvider exposes viewer without userId", () => {
    const source = readSource("components/projects/ProjectAccessProvider.tsx");
    expect(source).toContain("canManageProjects");
    expect(source).not.toContain("userId");
  });
});
