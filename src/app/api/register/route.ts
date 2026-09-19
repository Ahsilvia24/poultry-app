import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getNodePrisma } from "@/lib/prisma-node";
import { signinUnavailableMessage } from "@/lib/verify-credentials";
import { isRegisterEmailAllowed } from "@/lib/allowedRegisterEmails";
import { registerSchema } from "@/lib/validations";
import {
  createWebSession,
  putSessionOnResponse,
  requestUsesSecureCookies,
} from "@/lib/web-session";

export const dynamic = "force-dynamic";

function requestOrigin(req: Request) {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost.split(",")[0].trim()}`;
  }
  return url.origin;
}

async function readBody(req: Request): Promise<{ data: unknown; json: boolean }> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return { data: await req.json(), json: true };
  }
  if (ct.includes("form")) {
    const form = await req.formData();
    return {
      data: {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      },
      json: false,
    };
  }
  try {
    return { data: await req.json(), json: true };
  } catch {
    return { data: null, json: true };
  }
}

export async function POST(req: Request) {
  const origin = requestOrigin(req);
  let parsedBody: { data: unknown; json: boolean };
  try {
    parsedBody = await readBody(req);
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const fail = (message: string, status: number) => {
    if (parsedBody.json) return NextResponse.json({ error: message }, { status });
    const url = new URL("/register", origin);
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, 303);
  };

  if (parsedBody.data == null || typeof parsedBody.data !== "object") {
    return fail("Invalid input", 400);
  }

  const parsed = registerSchema.safeParse(parsedBody.data);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const email = parsed.data.email.toLowerCase();
  if (!isRegisterEmailAllowed(email)) {
    return fail("This email is not approved for an account.", 400);
  }

  const db = await getNodePrisma();
  let existing;
  try {
    existing = await db.user.findUnique({ where: { email } });
  } catch (error) {
    return fail(signinUnavailableMessage(error), 503);
  }
  if (existing) {
    return fail("An account with this email already exists", 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      settings: { create: {} },
    },
  });

  const created = await createWebSession(
    { id: user.id, email: user.email, name: user.name },
    undefined,
    requestUsesSecureCookies(req),
  );
  if ("error" in created) {
    if (parsedBody.json) {
      return NextResponse.json({ error: "Account created. Sign in with your email." }, { status: 400 });
    }
    return NextResponse.redirect(new URL("/login", origin), 303);
  }

  const res = parsedBody.json
    ? NextResponse.json({ ok: true })
    : NextResponse.redirect(new URL("/", origin), 303);
  return putSessionOnResponse(res, created.cookie);
}
