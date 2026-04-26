import { getServerSession, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { resolveWorkspaceAccessForUser } from "@/lib/workspaceAccess";

async function loadMembershipForSession(userId: string) {
  return resolveWorkspaceAccessForUser(userId);
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
  },
  pages: {
    signIn: "/sign-in",
  },
};

export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function requireUserIdWithWorkspace(): Promise<{
  userId: string;
  workspaceId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER";
}> {
  const session = await getServerSession(authOptions);
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
  const session = await getServerSession(authOptions);
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
