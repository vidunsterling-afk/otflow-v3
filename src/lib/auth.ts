/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}

class AccountDisabledError extends CredentialsSignin {
  code = "account_disabled";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 20 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new InvalidCredentialsError();
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
          include: { role: true },
        });

        if (!user) throw new InvalidCredentialsError();
        if (!user.isActive) throw new AccountDisabledError();

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!valid) throw new InvalidCredentialsError();

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          roleId: user.roleId,
          roleName: user.role.name,
          permissions: user.role.permissions,
          canApprove: user.canApprove,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.roleId = (user as any).roleId;
        token.roleName = (user as any).roleName;
        token.permissions = (user as any).permissions;
        token.canApprove = (user as any).canApprove;
      }
      // When update() is called from client, refresh the token expiry
      if (trigger === "update") {
        token.iat = Math.floor(Date.now() / 1000);
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as any).username = token.username;
      (session.user as any).roleId = token.roleId;
      (session.user as any).roleName = token.roleName;
      (session.user as any).permissions = token.permissions;
      (session.user as any).canApprove = token.canApprove;
      return session;
    },
  },
});
