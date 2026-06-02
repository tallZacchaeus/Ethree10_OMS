import type { NextAuthConfig } from "next-auth";
import type { Adapter, AdapterUser, AdapterAccount, VerificationToken } from "next-auth/adapters";
import Resend from "next-auth/providers/resend";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/server/db/client";
import { env } from "@/lib/env";

/**
 * Custom adapter that maps Auth.js operations onto our User and
 * OAuthAccount models instead of the standard @auth/prisma-adapter
 * table names (Account / Session).  VerificationToken uses the
 * standard model shape so Auth.js magic-link flow works out of the box.
 */
function createAdapter(): Adapter {
  return {
    async createUser(data) {
      const user = await db.user.create({
        data: {
          email: data.email,
          name: data.name ?? data.email.split("@")[0] ?? "User",
          emailVerified: data.emailVerified ?? null,
          avatarUrl: data.image ?? null,
        },
      });
      return toAdapterUser(user);
    },

    async getUser(id) {
      const user = await db.user.findUnique({ where: { id } });
      return user ? toAdapterUser(user) : null;
    },

    async getUserByEmail(email) {
      const user = await db.user.findUnique({ where: { email } });
      return user ? toAdapterUser(user) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await db.oAuthAccount.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true },
      });
      return account ? toAdapterUser(account.user) : null;
    },

    async updateUser(data) {
      const user = await db.user.update({
        where: { id: data.id },
        data: {
          name: data.name ?? undefined,
          email: data.email ?? undefined,
          emailVerified: data.emailVerified ?? undefined,
          avatarUrl: data.image ?? undefined,
        },
      });
      return toAdapterUser(user);
    },

    async linkAccount(data) {
      await db.oAuthAccount.create({
        data: {
          userId: data.userId,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          accessToken: data.access_token ?? null,
          refreshToken: data.refresh_token ?? null,
          expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
        },
      });
      return data as AdapterAccount;
    },

    async createVerificationToken(data: VerificationToken) {
      return db.verificationToken.create({ data });
    },

    async useVerificationToken({ identifier, token }) {
      try {
        const vt = await db.verificationToken.delete({
          where: { identifier_token: { identifier, token } },
        });
        return vt;
      } catch {
        return null;
      }
    },

    async deleteUser(userId) {
      await db.user.update({
        where: { id: userId },
        data: { deactivatedAt: new Date() },
      });
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await db.oAuthAccount.delete({
        where: { provider_providerAccountId: { provider, providerAccountId } },
      });
    },
  };
}

type UserRecord = {
  id: string;
  email: string;
  name: string;
  emailVerified: Date | null;
  avatarUrl: string | null;
};

function toAdapterUser(user: UserRecord): AdapterUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    image: user.avatarUrl,
  };
}

export const authConfig: NextAuthConfig = {
  adapter: createAdapter(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    verifyRequest: "/magic-link-sent",
    error: "/login",
  },
  providers: [
    Resend({
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
    }),
    Google({
      clientId: env.AUTH_GOOGLE_ID ?? "",
      clientSecret: env.AUTH_GOOGLE_SECRET ?? "",
    }),
    ...(process.env.NODE_ENV === "development"
      ? [
          Credentials({
            id: "credentials",
            name: "Local Dev Login",
            credentials: {
              email: { label: "Email", type: "email", placeholder: "admin@ethree10.r4c.global" },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null;
              
              let user = await db.user.findUnique({
                where: { email: credentials.email as string },
              });
              
              if (!user) {
                user = await db.user.create({
                  data: {
                    email: credentials.email as string,
                    name: (credentials.email as string).split("@")[0] || "User",
                    emailVerified: new Date(),
                  },
                });
              }
              
              return {
                id: user.id,
                email: user.email,
                name: user.name,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token["userId"] = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token["userId"]) {
        session.user.id = token["userId"] as string;
      }
      return session;
    },
  },
};
