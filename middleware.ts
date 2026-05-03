import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const secureCookie = request.nextUrl.protocol === "https:";
  let token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie,
  });

  // Edge/runtime fallback: explicitly read secure session-token cookie when auto-detection misses it.
  if (!token && secureCookie) {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: true,
      cookieName: "__Secure-next-auth.session-token",
    });
  }

  const { pathname } = request.nextUrl;
  const isProtected =
    pathname === "/chat" ||
    pathname.startsWith("/chat/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname.startsWith("/admin");

  if (isProtected && !token) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(signIn);
  }

  if (isProtected && token && !token.workspaceId) {
    const noWorkspace = new URL("/no-workspace", request.url);
    return NextResponse.redirect(noWorkspace);
  }

  // Align with server admin gates: workspace OWNER/ADMIN may access /admin, not only User.role=ADMIN.
  const workspaceRole = token?.workspaceRole as string | undefined;
  const isWorkspaceAdmin =
    workspaceRole === "OWNER" || workspaceRole === "ADMIN";
  const isPlatformAdmin = token?.role === "ADMIN";
  if (pathname.startsWith("/admin") && !isWorkspaceAdmin && !isPlatformAdmin) {
    const unauthorized = new URL("/unauthorized", request.url);
    return NextResponse.redirect(unauthorized);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat", "/chat/:path*", "/profile", "/profile/:path*", "/admin", "/admin/:path*"],
};
