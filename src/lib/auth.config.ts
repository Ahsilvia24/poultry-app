import type { NextAuthConfig } from "next-auth";
import { applyHostedEnv } from "@/lib/hosted-env";

applyHostedEnv();

export function isAuthDevBypassEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.AUTH_DEV_BYPASS === "true"
  );
}

/** Edge/proxy-safe Auth.js config. No Prisma or bcrypt here. */
export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
