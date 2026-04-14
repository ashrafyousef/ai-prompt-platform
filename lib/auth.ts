import { getServerSession, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  // Required in production (e.g. Vercel). Without it, sign-in shows "server configuration" error.
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        if (!email) return null;
        const user = await db.user.upsert({
          where: { email },
          update: {},
          create: { email, name: email.split("@")[0] },
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          teamId: user.teamId,
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
      } else if (token.sub && token.role === undefined) {
        const u = await db.user.findUnique({
          where: { id: token.sub },
          select: { role: true, teamId: true },
        });
        if (u) {
          token.role = u.role;
          token.teamId = u.teamId;
        }
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
      }
      return session;
    },
  },
};

export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}
