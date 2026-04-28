import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/chat", "/chat/:path*", "/profile", "/profile/:path*", "/admin", "/admin/:path*"],
};
