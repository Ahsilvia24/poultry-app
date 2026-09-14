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

/** Stay signed in on this phone. Field techs should not re-enter a password every month. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

/** Edge/proxy-safe Auth.js config. No Prisma or bcrypt here. */
export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.email = user.email;
        if (user.sessionId) token.sid = user.sessionId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        if (typeof token.sid === "string") {
          session.user.sessionId = token.sid;
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
