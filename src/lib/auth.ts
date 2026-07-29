import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Session } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const DEV_BYPASS = () => process.env.AUTH_DEV_BYPASS === "true";
const DEV_USER_EMAIL = () =>
  (process.env.AUTH_DEV_USER_EMAIL ?? "tech@poultry.local").toLowerCase();

async function resolveDevBypassSession(): Promise<Session | null> {
  if (!DEV_BYPASS()) return null;
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
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      // Avoid Prisma in this callback — Auth.js middleware runs on Edge.
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

type AuthFn = typeof nextAuth.auth;

/**
 * Session helper with optional AUTH_DEV_BYPASS (skips login in local/tunnel demos).
 * Also supports the Auth.js middleware wrapper form: auth((req) => ...).
 */
export const auth: AuthFn = ((...args: unknown[]) => {
  if (typeof args[0] === "function") {
    // Middleware / route handler wrapper — leave Auth.js wiring intact.
    return (nextAuth.auth as (...a: unknown[]) => unknown)(...args);
  }
  return (async () => {
    const session = await nextAuth.auth();
    if (DEV_BYPASS()) {
      // Prefer the live demo user over a stale JWT from a prior re-seed.
      const bypass = await resolveDevBypassSession();
      if (bypass?.user?.id) {
        if (!session?.user?.id || session.user.id !== bypass.user.id) {
          return bypass;
        }
      }
    }
    if (session?.user?.id) return session;
    return (await resolveDevBypassSession()) ?? session;
  })();
}) as AuthFn;

export function isAuthDevBypassEnabled() {
  return DEV_BYPASS();
}
