import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readSource(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

function extractMobileCardBlock(source: string): string {
  const start = source.indexOf('className="space-y-3 md:hidden"');
  const end = source.indexOf('<Card padding="none" className="hidden overflow-x-auto md:block"');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

function extractDesktopTableBlock(source: string): string {
  const start = source.indexOf('<Card padding="none" className="hidden overflow-x-auto md:block"');
  expect(start).toBeGreaterThan(-1);
  return source.slice(start);
}

describe("projects list page (Phase 4B.2)", () => {
  const source = readSource("app/(app)/projects/page.tsx");
  const mobileBlock = extractMobileCardBlock(source);
  const desktopBlock = extractDesktopTableBlock(source);

  it("fetches /api/projects for all workspace roles", () => {
    expect(source).toContain('fetch("/api/projects"');
    expect(source).not.toContain("/api/admin/projects");
  });

  it("hides Manage in Admin for MEMBER via canManageProjects", () => {
    expect(source).toContain("canManageProjects");
    expect(source).toMatch(/canManageProjects \? \([\s\S]*Manage in Admin/);
    expect(source).toContain("No projects are currently assigned to your team.");
  });

  it("keeps manager empty-state guidance", () => {
    expect(source).toContain("No projects yet. Create one from Admin → Projects.");
  });

  it("links project rows to /projects/<id>", () => {
    expect(source).toContain("href={`/projects/${encodeURIComponent(project.id)}`}");
  });

  it("puts padding and focus-visible classes on the mobile Link, not the Card", () => {
    expect(mobileBlock).toContain('<Card key={`mobile-${project.id}`} padding="none">');
    expect(mobileBlock).toMatch(
      /<Link[\s\S]*href=\{`\/projects\/\$\{encodeURIComponent\(project\.id\)\}`\}[\s\S]*className=\{mobileProjectLinkClass\}/
    );
    expect(mobileBlock).toContain("mobileProjectLinkClass");
    expect(source).toMatch(
      /const mobileProjectLinkClass =\s*"block rounded-2xl p-4[\s\S]*focus-visible:ring-2/
    );
    expect(mobileBlock).not.toMatch(/<Card[^>]*className=\{mobileProjectLinkClass\}/);
    expect(mobileBlock).not.toMatch(/<Link[^>]*className="block"/);
  });

  it("does not apply full-row desktop hover; styles the project-name Link instead", () => {
    expect(desktopBlock).not.toMatch(/<tr[^>]*hover:bg-/);
    expect(desktopBlock).toMatch(
      /<Link[\s\S]*href=\{`\/projects\/\$\{encodeURIComponent\(project\.id\)\}`\}[\s\S]*className=\{desktopProjectLinkClass\}/
    );
    expect(source).toMatch(
      /const desktopProjectLinkClass =[\s\S]*hover:underline[\s\S]*focus-visible:ring-2/
    );
  });
});
