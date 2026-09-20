import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Session } from "next-auth";
import { z } from "zod";
import { clearActiveSession, isActiveSession } from "@/lib/active-session";
import { applyHostedEnv } from "@/lib/hosted-env";
import { authConfig, isAuthDevBypassEnabled } from "@/lib/auth.config";

applyHostedEnv();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  deviceId: z.string().optional(),
});

const DEV_USER_EMAIL = () =>
  (process.env.AUTH_DEV_USER_EMAIL ?? "tech@poultry.local").toLowerCase();

async function resolveDevBypassSession(): Promise<Session | null> {
  if (!isAuthDevBypassEnabled()) return null;
  return {
    user: {
      id: "dev-bypass",
      email: DEV_USER_EMAIL(),
      name: "Dev",
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
        // Passwords live on the phone. Hosted Auth.js credentials are unused.
        return null;
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
      try {
        const active = await isActiveSession(session.user.id, session.user.sessionId);
        if (!active) return null;
      } catch {
        return session;
      }
      return session;
    } catch {
      return null;
    }
  })();
}) as AuthFn;
