import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readSource(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

describe("Phase 4B.2 page-gate regression", () => {
  it("admits authenticated workspace users to /projects middleware without MEMBER denial", () => {
    const source = readSource("middleware.ts");
    expect(source).toContain('pathname === "/projects"');
    expect(source).toContain("isProjectsPath");
    expect(source).toMatch(/Phase 4B\.2/);
    expect(source).toContain('pathname.startsWith("/admin")');
    expect(source).not.toMatch(
      /isProjectsPath[\s\S]*workspaceRole === "MEMBER"[\s\S]*\/unauthorized/
    );
  });

  it("keeps /admin manager-gated in middleware", () => {
    const source = readSource("middleware.ts");
    expect(source).toMatch(/workspaceRole === "OWNER" \|\| workspaceRole === "ADMIN"/);
    expect(source).toContain('token?.role === "ADMIN"');
    expect(source).toContain("/unauthorized");
  });

  it("uses DB-backed getProjectSessionOrRedirect in projects layout", () => {
    const source = readSource("app/(app)/projects/layout.tsx");
    expect(source).toContain("getProjectSessionOrRedirect");
    expect(source).not.toContain("getAdminSessionOrRedirect");
    expect(source).toContain("ProjectAccessProvider");
  });

  it("branches project detail on canManageProjects from useProjectAccess", () => {
    const source = readSource("app/(app)/projects/[projectId]/page.tsx");
    expect(source).toContain("useProjectAccess");
    expect(source).toContain("canManageProjects");
    expect(source).toContain("ProjectDetailPage");
    expect(source).toContain("MemberProjectDetailPage");
  });

  it("uses GET /api/projects for the workspace project list", () => {
    const source = readSource("app/(app)/projects/page.tsx");
    expect(source).toContain('fetch("/api/projects"');
    expect(source).not.toContain("/api/admin/projects");
    expect(source).toContain("useProjectAccess");
  });
});
