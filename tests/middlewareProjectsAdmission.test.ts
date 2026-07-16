import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getToken = vi.fn();
const next = vi.fn(() => ({ kind: "next" }));
const redirect = vi.fn((url: URL) => ({ kind: "redirect", url: url.toString() }));

vi.mock("next-auth/jwt", () => ({
  getToken,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next,
    redirect,
  },
}));

function makeRequest(pathname: string, protocol = "http:"): NextRequest {
  const nextUrl = new URL(`${protocol}//localhost${pathname}`);
  return {
    nextUrl,
    url: nextUrl.toString(),
  } as NextRequest;
}

describe("middleware /projects admission (Phase 4B.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  it("redirects unauthenticated /projects to sign-in with callback", async () => {
    getToken.mockResolvedValue(null);
    const { middleware } = await import("@/middleware");
    const result = await middleware(makeRequest("/projects"));

    expect(redirect).toHaveBeenCalledTimes(1);
    const url = redirect.mock.calls[0][0] as URL;
    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("callbackUrl")).toBe("/projects");
    expect(result).toEqual({ kind: "redirect", url: url.toString() });
  });

  it("redirects token without workspaceId on /projects to /no-workspace", async () => {
    getToken.mockResolvedValue({
      sub: "user-1",
      workspaceRole: "MEMBER",
    });
    const { middleware } = await import("@/middleware");
    await middleware(makeRequest("/projects"));

    expect(redirect).toHaveBeenCalledTimes(1);
    const url = redirect.mock.calls[0][0] as URL;
    expect(url.pathname).toBe("/no-workspace");
  });

  it("admits MEMBER to /projects", async () => {
    getToken.mockResolvedValue({
      sub: "member-1",
      workspaceId: "ws-1",
      workspaceRole: "MEMBER",
      role: "USER",
    });
    const { middleware } = await import("@/middleware");
    const result = await middleware(makeRequest("/projects"));

    expect(next).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "next" });
  });

  it("admits MEMBER to /projects/<id>", async () => {
    getToken.mockResolvedValue({
      sub: "member-1",
      workspaceId: "ws-1",
      workspaceRole: "MEMBER",
      role: "USER",
    });
    const { middleware } = await import("@/middleware");
    const result = await middleware(makeRequest("/projects/project-1"));

    expect(next).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "next" });
  });

  it("denies MEMBER /admin with /unauthorized", async () => {
    getToken.mockResolvedValue({
      sub: "member-1",
      workspaceId: "ws-1",
      workspaceRole: "MEMBER",
      role: "USER",
    });
    const { middleware } = await import("@/middleware");
    await middleware(makeRequest("/admin"));

    expect(redirect).toHaveBeenCalledTimes(1);
    const url = redirect.mock.calls[0][0] as URL;
    expect(url.pathname).toBe("/unauthorized");
  });

  it("admits workspace OWNER to /admin", async () => {
    getToken.mockResolvedValue({
      sub: "owner-1",
      workspaceId: "ws-1",
      workspaceRole: "OWNER",
      role: "USER",
    });
    const { middleware } = await import("@/middleware");
    const result = await middleware(makeRequest("/admin/projects"));

    expect(next).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: "next" });
  });
});
