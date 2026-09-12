import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    sessionId?: string;
  }

  interface Session {
    user: {
      id: string;
      sessionId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sid?: string;
  }
}
