import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Session } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { clearActiveSession, isActiveSession, rotateActiveSession } from "@/lib/active-session";
import { applyHostedEnv } from "@/lib/hosted-env";
import { authConfig, isAuthDevBypassEnabled } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

applyHostedEnv();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const DEV_USER_EMAIL = () =>
  (process.env.AUTH_DEV_USER_EMAIL ?? "tech@poultry.local").toLowerCase();

async function resolveDevBypassSession(): Promise<Session | null> {
  if (!isAuthDevBypassEnabled()) return null;
  const user = await prisma.user.findUnique({
    where: { email: DEV_USER_EMAIL() },
  });
  if (!user) return null;
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        const sessionId = await rotateActiveSession(user.id);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          sessionId,
        };
      },
    }),
  ],
  events: {
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      const userId = token?.sub;
      const sid = typeof token?.sid === "string" ? token.sid : undefined;
      if (!userId) return;
      await clearActiveSession(userId, sid);
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;
export { isAuthDevBypassEnabled };

type AuthFn = typeof nextAuth.auth;

/**
 * Session helper with optional AUTH_DEV_BYPASS (skips login in local/tunnel demos).
 * Also supports the Auth.js middleware / proxy wrapper form: auth((req) => ...).
 */
export const auth: AuthFn = ((...args: unknown[]) => {
  if (typeof args[0] === "function") {
    return (nextAuth.auth as (...a: unknown[]) => unknown)(...args);
  }
  return (async () => {
    try {
      const session = await nextAuth.auth();
      if (isAuthDevBypassEnabled()) {
        const bypass = await resolveDevBypassSession();
        if (bypass?.user?.id) {
          if (!session?.user?.id || session.user.id !== bypass.user.id) {
            return bypass;
          }
        }
      }
      if (!session?.user?.id) return null;
      if (isAuthDevBypassEnabled()) return session;
      const active = await isActiveSession(session.user.id, session.user.sessionId);
      if (!active) return null;
      return session;
    } catch {
      return null;
    }
  })();
}) as AuthFn;
