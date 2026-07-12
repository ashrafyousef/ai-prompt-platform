import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminSessionOrRedirect = vi.fn();

vi.mock("@/lib/adminAuth", () => ({
  getAdminSessionOrRedirect,
}));

describe("app/(app)/projects/layout.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("awaits getAdminSessionOrRedirect before rendering children", async () => {
    const callOrder: string[] = [];
    getAdminSessionOrRedirect.mockImplementation(async () => {
      callOrder.push("guard");
      return { userId: "manager-1", session: { user: { id: "manager-1" } } };
    });

    const { default: ProjectsLayout } = await import("@/app/(app)/projects/layout");
    const children = { type: "div", props: { children: "workspace" } };

    callOrder.push("before-layout");
    const result = await ProjectsLayout({ children });
    callOrder.push("after-layout");

    expect(getAdminSessionOrRedirect).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["before-layout", "guard", "after-layout"]);
    expect(result).toBe(children);
  });

  it("returns children only after the database-backed manager guard succeeds", async () => {
    getAdminSessionOrRedirect.mockResolvedValue({
      userId: "owner-1",
      session: { user: { id: "owner-1" } },
    });

    const { default: ProjectsLayout } = await import("@/app/(app)/projects/layout");
    const children = "projects-ok";
    const result = await ProjectsLayout({ children });

    expect(getAdminSessionOrRedirect).toHaveBeenCalledTimes(1);
    expect(result).toBe("projects-ok");
  });

  it("does not render children when the manager guard redirects (e.g. plain MEMBER)", async () => {
    getAdminSessionOrRedirect.mockImplementation(async () => {
      throw new Error("NEXT_REDIRECT:/unauthorized");
    });

    const { default: ProjectsLayout } = await import("@/app/(app)/projects/layout");

    await expect(ProjectsLayout({ children: "should-not-render" })).rejects.toThrow(
      "NEXT_REDIRECT:/unauthorized"
    );
    expect(getAdminSessionOrRedirect).toHaveBeenCalledTimes(1);
  });
});
