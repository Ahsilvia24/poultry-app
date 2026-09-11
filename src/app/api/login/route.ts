import { NextResponse } from "next/server";
import { establishWebSession } from "@/lib/web-session";

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

async function readCredentials(req: Request): Promise<{
  email: string;
  password: string;
  json: boolean;
}> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    return {
      email: String(body.email ?? "").trim().toLowerCase(),
      password: String(body.password ?? ""),
      json: true,
    };
  }
  if (ct.includes("form")) {
    const form = await req.formData();
    return {
      email: String(form.get("email") ?? "").trim().toLowerCase(),
      password: String(form.get("password") ?? ""),
      json: false,
    };
  }
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    return {
      email: String(body.email ?? "").trim().toLowerCase(),
      password: String(body.password ?? ""),
      json: true,
    };
  } catch {
    return { email: "", password: "", json: true };
  }
}

export async function POST(req: Request) {
  const origin = requestOrigin(req);
  let parsed: { email: string; password: string; json: boolean };
  try {
    parsed = await readCredentials(req);
  } catch {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }

  const fail = (message: string, status: number) => {
    if (parsed.json) return NextResponse.json({ error: message }, { status });
    const url = new URL("/login", origin);
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, 303);
  };

  if (!parsed.email || !parsed.password) {
    return fail("Invalid email or password", 400);
  }

  const result = await establishWebSession(parsed.email, parsed.password);
  if (result.error) return fail(result.error, 401);

  if (parsed.json) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL("/", origin), 303);
}
