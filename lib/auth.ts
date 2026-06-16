import { getServerSession, type Session, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import type { UserRole } from "@/lib/models";
import { resolveWorkspaceAccessForUser } from "@/lib/workspaceAccess";

async function loadMembershipForSession(userId: string) {
  return resolveWorkspaceAccessForUser(userId);
}

function isSafeRelativePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || typeof password !== "string" || password.length === 0) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            teamId: true,
            passwordHash: true,
          },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          return null;
        }

        const workspaceAccess = await loadMembershipForSession(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          teamId: workspaceAccess.teamId ?? user.teamId,
          workspaceId: workspaceAccess.workspaceId,
          workspaceRole: workspaceAccess.workspaceRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.role = (user as { role?: string }).role;
        token.teamId = (user as { teamId?: string | null }).teamId ?? null;
        token.workspaceId = (user as { workspaceId?: string | null }).workspaceId ?? null;
        token.workspaceRole = (user as { workspaceRole?: string | null }).workspaceRole ?? null;
      } else if (token.sub) {
        const u = await db.user.findUnique({
          where: { id: token.sub },
          select: { role: true, teamId: true },
        });
        if (u) {
          token.role = u.role;
          token.teamId = u.teamId;
        }
        const workspaceAccess = await loadMembershipForSession(token.sub);
        token.workspaceId = workspaceAccess.workspaceId;
        token.workspaceRole = workspaceAccess.workspaceRole;
        token.teamId = workspaceAccess.teamId ?? token.teamId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        const r = token.role;
        session.user.role =
          r === "USER" || r === "TEAM_LEAD" || r === "ADMIN" ? r : undefined;
        session.user.teamId = token.teamId ?? null;
        const wr = token.workspaceRole;
        session.user.workspaceId = (token.workspaceId as string | undefined) ?? null;
        session.user.workspaceRole =
          wr === "OWNER" || wr === "ADMIN" || wr === "MEMBER" ? wr : null;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (isSafeRelativePath(url)) {
        return url;
      }

      try {
        const target = new URL(url);
        const base = new URL(baseUrl);
        if (target.origin === base.origin) {
          return `${target.pathname}${target.search}${target.hash}`;
        }
      } catch {
        // Fall through to safe local path.
      }

      return "/chat";
    },
  },
  pages: {
    signIn: "/sign-in",
  },
};

function isHttpsRequest(req: NextRequest): boolean {
  return (
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https"
  );
}

function requestFromHeaders(): NextRequest {
  const headerStore = headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost";
  const proto =
    headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (host.includes("localhost") ? "http" : "https");
  const cookie = headerStore.get("cookie") ?? "";
  return new NextRequest(`${proto}://${host}/`, {
    headers: cookie ? { cookie } : undefined,
  });
}

async function resolveAuthToken(req?: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const request = req ?? requestFromHeaders();
  const secureCookie = isHttpsRequest(request);

  let token = await getToken({ req: request, secret, secureCookie });
  if (!token && secureCookie) {
    token = await getToken({
      req: request,
      secret,
      secureCookie: true,
      cookieName: "__Secure-next-auth.session-token",
    });
  }

  return token;
}

function sessionFromToken(token: NonNullable<Awaited<ReturnType<typeof getToken>>>): Session {
  const r = token.role;
  const role = r === "USER" || r === "TEAM_LEAD" || r === "ADMIN" ? r : undefined;
  const wr = token.workspaceRole;
  const workspaceRole =
    wr === "OWNER" || wr === "ADMIN" || wr === "MEMBER" ? wr : null;

  return {
    user: {
      id: token.sub as string,
      email: typeof token.email === "string" ? token.email : undefined,
      name: typeof token.name === "string" ? token.name : undefined,
      role,
      teamId: (token.teamId as string | null | undefined) ?? null,
      workspaceId: (token.workspaceId as string | undefined) ?? null,
      workspaceRole,
    },
    expires:
      typeof token.exp === "number"
        ? new Date(token.exp * 1000).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Resolve the current session in App Router route handlers.
 * Mirrors middleware secure-cookie handling, then falls back to getServerSession.
 */
export async function getAuthSession(req?: NextRequest): Promise<Session | null> {
  const token = await resolveAuthToken(req);
  if (token?.sub) {
    return sessionFromToken(token);
  }
  return getServerSession(authOptions);
}

export async function requireUserId(): Promise<string> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

/**
 * Role used for model registry / cost-tier governance and token soft limits.
 * Workspace OWNER and workspace ADMIN get ADMIN-tier model access; platform ADMIN stays ADMIN;
 * platform TEAM_LEAD stays TEAM_LEAD; otherwise USER.
 */
export function resolveModelGovernanceRole(params: {
  platformRole: "USER" | "TEAM_LEAD" | "ADMIN";
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null | undefined;
}): UserRole {
  if (params.platformRole === "ADMIN") return "ADMIN";
  const wr = params.workspaceRole;
  if (wr === "OWNER" || wr === "ADMIN") return "ADMIN";
  if (params.platformRole === "TEAM_LEAD") return "TEAM_LEAD";
  return "USER";
}

export async function requireUserIdWithWorkspace(): Promise<{
  userId: string;
  workspaceId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER";
}> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const workspaceAccess = await resolveWorkspaceAccessForUser(session.user.id);
  if (!workspaceAccess.hasWorkspaceMembership || !workspaceAccess.workspaceId || !workspaceAccess.workspaceRole) {
    throw new Error("NoWorkspaceMembership");
  }

  return {
    userId: session.user.id,
    workspaceId: workspaceAccess.workspaceId,
    workspaceRole: workspaceAccess.workspaceRole,
  };
}

export type AuthorizedUserContext = {
  userId: string;
  role: "USER" | "TEAM_LEAD" | "ADMIN";
  /** Same as {@link resolveModelGovernanceRole} for this user + active workspace membership. */
  modelGovernanceRole: UserRole;
  teamId: string | null;
  workspaceId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER";
};

/**
 * Phase 1.3 auth context:
 * - identity anchor: session.user.id
 * - workspace access truth: WorkspaceMember (resolved from DB)
 * - User.role remains compatibility input for existing platform-level gates
 */
export async function requireAuthorizedUserContext(): Promise<AuthorizedUserContext> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const [workspaceAccess, user] = await Promise.all([
    resolveWorkspaceAccessForUser(session.user.id),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, teamId: true },
    }),
  ]);

  if (!workspaceAccess.hasWorkspaceMembership || !workspaceAccess.workspaceId || !workspaceAccess.workspaceRole) {
    throw new Error("NoWorkspaceMembership");
  }

  if (!user) {
    throw new Error("Unauthorized");
  }

  return {
    userId: session.user.id,
    role: user.role,
    modelGovernanceRole: resolveModelGovernanceRole({
      platformRole: user.role,
      workspaceRole: workspaceAccess.workspaceRole,
    }),
    teamId: workspaceAccess.teamId ?? user.teamId,
    workspaceId: workspaceAccess.workspaceId,
    workspaceRole: workspaceAccess.workspaceRole,
  };
}

export function authErrorStatus(error: unknown, fallbackStatus = 400): number {
  const message = error instanceof Error ? error.message : "";
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden" || message === "NoWorkspaceMembership") return 403;
  return fallbackStatus;
}
