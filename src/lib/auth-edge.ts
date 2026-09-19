import NextAuth from "next-auth";
import { authConfig, isAuthDevBypassEnabled } from "@/lib/auth.config";

/** JWT-only Auth.js for Edge/proxy. Do not import Prisma or `pg` here. */
export { isAuthDevBypassEnabled };

const nextAuth = NextAuth(authConfig);
export const { auth } = nextAuth;
