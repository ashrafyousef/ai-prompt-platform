import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect,
}));

describe("app/admin/projects/[projectId]/page.tsx redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("redirects the old admin detail URL to the workspace project route", async () => {
    const { default: AdminProjectDetailRedirect } = await import(
      "@/app/admin/projects/[projectId]/page"
    );

    expect(() =>
      AdminProjectDetailRedirect({ params: { projectId: "project-1" } })
    ).toThrow("NEXT_REDIRECT:/projects/project-1");

    expect(redirect).toHaveBeenCalledWith("/projects/project-1");
  });

  it("encodes the projectId in the redirect target", async () => {
    const { default: AdminProjectDetailRedirect } = await import(
      "@/app/admin/projects/[projectId]/page"
    );

    expect(() =>
      AdminProjectDetailRedirect({ params: { projectId: "proj/with spaces" } })
    ).toThrow(`NEXT_REDIRECT:/projects/${encodeURIComponent("proj/with spaces")}`);

    expect(redirect).toHaveBeenCalledWith(
      `/projects/${encodeURIComponent("proj/with spaces")}`
    );
  });
});
