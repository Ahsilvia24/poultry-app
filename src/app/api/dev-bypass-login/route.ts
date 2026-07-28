import { NextResponse } from "next/server";
import { signIn } from "@/lib/auth";

function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  // Avoid listening address (0.0.0.0) leaking into redirects
  if (url.hostname === "0.0.0.0" || url.hostname === "::") {
    return `http://127.0.0.1:${url.port || "3000"}`;
  }
  return url.origin;
}

/**
 * Establishes a real Auth.js session cookie for AUTH_DEV_BYPASS demos.
 * Visit once (middleware redirects here) so Server Actions work through tunnels.
 */
export async function GET(request: Request) {
  if (process.env.AUTH_DEV_BYPASS !== "true") {
    return NextResponse.json({ error: "Dev bypass disabled" }, { status: 404 });
  }

  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const nextPath = url.searchParams.get("next") || "/";
  const safeNext = nextPath.startsWith("/") ? nextPath : "/";
  const destination = new URL(safeNext, origin);

  try {
    await signIn("credentials", {
      email: (process.env.AUTH_DEV_USER_EMAIL ?? "tech@poultry.local").toLowerCase(),
      password: process.env.AUTH_DEV_USER_PASSWORD ?? "password123",
      redirect: false,
      redirectTo: destination.toString(),
    });
  } catch (e) {
    const digest =
      e && typeof e === "object" && "digest" in e
        ? String((e as { digest?: string }).digest)
        : "";
    if (!digest.includes("NEXT_REDIRECT")) {
      console.error("dev-bypass-login failed", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Sign-in failed" },
        { status: 500 },
      );
    }
  }

  return NextResponse.redirect(destination);
}
