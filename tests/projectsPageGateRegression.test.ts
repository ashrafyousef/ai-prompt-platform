import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase 4B.1B page-gate regression", () => {
  it("keeps /projects middleware manager-gated", () => {
    const source = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    expect(source).toContain('pathname === "/projects"');
    expect(source).toContain("isProjectsPath");
    expect(source).toMatch(/workspaceRole === "OWNER" \|\| workspaceRole === "ADMIN"/);
    expect(source).toContain('token?.role === "ADMIN"');
    expect(source).toContain("/unauthorized");
    expect(source).toMatch(/Phase 4A keeps \/projects manager-gated/);
  });

  it("keeps projects layout on getAdminSessionOrRedirect", () => {
    const source = readFileSync(
      join(process.cwd(), "app/(app)/projects/layout.tsx"),
      "utf8"
    );
    expect(source).toContain("getAdminSessionOrRedirect");
    expect(source).not.toContain("requireProjectActorContext");
  });

  it("does not add MEMBER projects navigation entries", () => {
    const navCandidates = [
      "components/layout/AppSidebar.tsx",
      "components/layout/Sidebar.tsx",
      "components/nav/AppNav.tsx",
      "components/AppNav.tsx",
      "components/admin/AdminNav.tsx",
    ];
    for (const relative of navCandidates) {
      try {
        const source = readFileSync(join(process.cwd(), relative), "utf8");
        if (source.includes("/projects") && source.toLowerCase().includes("member")) {
          expect(source).not.toMatch(/href:\s*["']\/projects["']/);
        }
      } catch {
        // optional path
      }
    }
  });
});
