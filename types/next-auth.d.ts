import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id: string;
      /** Mirrors Prisma `UserRole` */
      role?: "USER" | "TEAM_LEAD" | "ADMIN";
      teamId?: string | null;
    };
  }

  interface User {
    role?: "USER" | "TEAM_LEAD" | "ADMIN";
    teamId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    teamId?: string | null;
  }
}
