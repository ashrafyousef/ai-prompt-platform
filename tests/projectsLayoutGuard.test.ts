import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const getProjectSessionOrRedirect = vi.fn();

vi.mock("@/lib/projectActorContext", () => ({
  getProjectSessionOrRedirect,
}));

function readLayoutSource(): string {
  return readFileSync(join(process.cwd(), "app/(app)/projects/layout.tsx"), "utf8");
}

describe("app/(app)/projects/layout.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses getProjectSessionOrRedirect and ProjectAccessProvider in source", () => {
    const source = readLayoutSource();
    expect(source).toContain("getProjectSessionOrRedirect");
    expect(source).not.toContain("getAdminSessionOrRedirect");
    expect(source).toContain("ProjectAccessProvider");
    expect(source).toMatch(/Phase 4B\.2/);
  });

  it("wraps children in ProjectAccessProvider for a valid MEMBER actor", async () => {
    const viewer = {
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: "team-a",
      canManageProjects: false,
    };
    getProjectSessionOrRedirect.mockResolvedValue({
      actor: { userId: "member-1" },
      viewer,
    });

    const { default: ProjectsLayout } = await import("@/app/(app)/projects/layout");
    const { ProjectAccessProvider } = await import(
      "@/components/projects/ProjectAccessProvider"
    );
    const children = React.createElement("div", null, "projects-ok");
    const result = await ProjectsLayout({ children });

    expect(getProjectSessionOrRedirect).toHaveBeenCalledTimes(1);
    expect(React.isValidElement(result)).toBe(true);
    expect(result.type).toBe(ProjectAccessProvider);
    expect(result.props.viewer).toEqual(viewer);
    expect(result.props.viewer).not.toHaveProperty("userId");
    expect(result.props.children).toBe(children);
  });

  it("wraps children for a manager viewer with canManageProjects true", async () => {
    const viewer = {
      workspaceRole: "OWNER" as const,
      platformRole: "USER" as const,
      teamId: null,
      canManageProjects: true,
    };
    getProjectSessionOrRedirect.mockResolvedValue({
      actor: { userId: "owner-1" },
      viewer,
    });

    const { default: ProjectsLayout } = await import("@/app/(app)/projects/layout");
    const { ProjectAccessProvider } = await import(
      "@/components/projects/ProjectAccessProvider"
    );
    const children = React.createElement("div", null, "manager-ok");
    const result = await ProjectsLayout({ children });

    expect(getProjectSessionOrRedirect).toHaveBeenCalledTimes(1);
    expect(result.type).toBe(ProjectAccessProvider);
    expect(result.props.viewer).toEqual(viewer);
    expect(result.props.viewer.canManageProjects).toBe(true);
    expect(result.props.children).toBe(children);
  });

  it("does not render children when the DB-backed actor gate redirects", async () => {
    getProjectSessionOrRedirect.mockImplementation(async () => {
      throw new Error("NEXT_REDIRECT:/unauthorized");
    });

    const { default: ProjectsLayout } = await import("@/app/(app)/projects/layout");

    await expect(
      ProjectsLayout({ children: React.createElement("div", null, "should-not-render") })
    ).rejects.toThrow("NEXT_REDIRECT:/unauthorized");
    expect(getProjectSessionOrRedirect).toHaveBeenCalledTimes(1);
  });
});
