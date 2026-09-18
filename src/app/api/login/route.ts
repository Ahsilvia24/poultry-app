import { NextResponse } from "next/server";
import { isDeviceId } from "@/lib/device-id";
import { replaceLoginStatus } from "@/lib/replace-login";
import { cookieHeaderHasSessionToken } from "@/lib/session-cookie";
import { verifyLoginPassword } from "@/lib/verify-credentials";
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

function truthy(value: unknown) {
  return value === true || value === "1" || value === "true";
}

function readDeviceId(value: unknown) {
  return isDeviceId(value) ? value : undefined;
}

async function readCredentials(req: Request): Promise<{
  email: string;
  password: string;
  confirmReplace: boolean;
  deviceId?: string;
  json: boolean;
}> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await req.json()) as {
      email?: unknown;
      password?: unknown;
      confirmReplace?: unknown;
      deviceId?: unknown;
    };
    return {
      email: String(body.email ?? "").trim().toLowerCase(),
      password: String(body.password ?? ""),
      confirmReplace: truthy(body.confirmReplace),
      deviceId: readDeviceId(body.deviceId),
      json: true,
    };
  }
  if (ct.includes("form")) {
    const form = await req.formData();
    return {
      email: String(form.get("email") ?? "").trim().toLowerCase(),
      password: String(form.get("password") ?? ""),
      confirmReplace: truthy(form.get("confirmReplace")),
      deviceId: readDeviceId(form.get("deviceId")),
      json: false,
    };
  }
  try {
    const body = (await req.json()) as {
      email?: unknown;
      password?: unknown;
      confirmReplace?: unknown;
      deviceId?: unknown;
    };
    return {
      email: String(body.email ?? "").trim().toLowerCase(),
      password: String(body.password ?? ""),
      confirmReplace: truthy(body.confirmReplace),
      deviceId: readDeviceId(body.deviceId),
      json: true,
    };
  } catch {
    return { email: "", password: "", confirmReplace: false, json: true };
  }
}

export async function POST(req: Request) {
  const origin = requestOrigin(req);
  let parsed: {
    email: string;
    password: string;
    confirmReplace: boolean;
    deviceId?: string;
    json: boolean;
  };
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

  const user = await verifyLoginPassword(parsed.email, parsed.password);
  if (!user) return fail("Invalid email or password", 401);

  if (!parsed.confirmReplace) {
    const status = replaceLoginStatus({
      activeSessionId: user.activeSessionId,
      activeDeviceId: user.activeDeviceId,
      unsyncedAt: user.unsyncedAt,
      currentDeviceId: parsed.deviceId,
      sameBrowser: cookieHeaderHasSessionToken(req.headers.get("cookie")),
    });
    if (status.otherDevice) {
      if (parsed.json) {
        return NextResponse.json({
          needsConfirm: true,
          unsynced: status.unsynced,
          knownOtherDevice: status.knownOtherDevice,
        });
      }
      const url = new URL("/login", origin);
      url.searchParams.set("confirm", status.unsynced ? "unsynced" : "replace");
      if (status.knownOtherDevice) url.searchParams.set("other", "1");
      return NextResponse.redirect(url, 303);
    }
  }

  const result = await establishWebSession(user.email, parsed.password, parsed.deviceId);
  if (result.error) return fail(result.error, 401);

  if (parsed.json) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL("/", origin), 303);
}
