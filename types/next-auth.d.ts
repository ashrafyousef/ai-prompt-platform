import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id: string;
      /** Mirrors Prisma `UserRole` (platform / legacy). */
      role?: "USER" | "TEAM_LEAD" | "ADMIN";
      teamId?: string | null;
      /** Active workspace from first membership (Phase 1). */
      workspaceId?: string | null;
      /** Mirrors Prisma `WorkspaceRole`. */
      workspaceRole?: "OWNER" | "ADMIN" | "MEMBER" | null;
    };
  }

  interface User {
    role?: "USER" | "TEAM_LEAD" | "ADMIN";
    teamId?: string | null;
    workspaceId?: string | null;
    workspaceRole?: "OWNER" | "ADMIN" | "MEMBER" | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    teamId?: string | null;
    workspaceId?: string | null;
    workspaceRole?: string | null;
  }
}
