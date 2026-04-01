import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import { prisma } from "./prisma";
import { createHash } from "crypto";

function verifyPassword(plain: string, hashed: string): boolean {
  return createHash("sha256").update(plain).digest("hex") === hashed;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string, active: true },
        });
        if (!user) return null;

        const valid = verifyPassword(
          credentials.password as string,
          user.hashedPassword
        );
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          locationId: user.locationId,
        };
      },
    }),
  ],
});
