import type { NextAuthConfig } from "next-auth";

// This config is used by the middleware (Edge runtime)
// It should NOT import Prisma or any Node.js-only modules
// The authorize function is in auth.ts which runs on Node.js
export default {
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.locationId = (user as { locationId?: string }).locationId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
        (session.user as { locationId?: string }).locationId = token.locationId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;
