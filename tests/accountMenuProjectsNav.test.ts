import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readSource(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

describe("AccountMenu projects navigation (Phase 4B.2)", () => {
  it("separates canAccessProjects from isAdmin in AccountMenu", () => {
    const source = readSource("components/chat/AccountMenu.tsx");
    expect(source).toContain("canAccessProjects");
    expect(source).toContain("isAdmin");
    expect(source).toContain('href="/projects"');
    expect(source).toContain('href="/admin"');
    expect(source).toMatch(/\{canAccessProjects \?/);
    expect(source).toMatch(/\{isAdmin \?/);
  });

  it("closes the account menu when Projects is clicked", () => {
    const source = readSource("components/chat/AccountMenu.tsx");
    expect(source).toMatch(/href="\/projects"[\s\S]*onClick=\{onClose\}/);
  });

  it("passes workspace access and admin flags separately from ChatSidebar", () => {
    const source = readSource("components/chat/ChatSidebar.tsx");
    expect(source).toContain("canAccessProjects={Boolean(session?.user?.workspaceId)}");
    expect(source).toContain("isAdmin=");
  });

  it("allows MEMBER to see Projects without Admin link in source structure", () => {
    const source = readSource("components/chat/AccountMenu.tsx");
    const projectsBlock = source.slice(
      source.indexOf("{canAccessProjects ?"),
      source.indexOf("{isAdmin ?")
    );
    expect(projectsBlock).toContain('href="/projects"');
    expect(projectsBlock).not.toContain('href="/admin"');
  });
});
