import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, isAuthDevBypassEnabled } from "@/lib/auth";

/** Prefer forwarded host/proto so tunnels (Cloudflare, Cursor) don't redirect to localhost. */
function requestOrigin(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    if (host && host !== "0.0.0.0" && !host.startsWith("127.0.0.1")) {
      const proto =
        forwardedProto?.split(",")[0]?.trim() ||
        (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
      return `${proto}://${host}`;
    }
  }
  const origin = req.nextUrl.origin;
  if (origin.includes("0.0.0.0")) {
    return origin.replace("0.0.0.0", "127.0.0.1");
  }
  return origin;
}

export default auth((req) => {
  const bypass = isAuthDevBypassEnabled();
  const isLoggedIn = !!req.auth || bypass;
  const { pathname } = req.nextUrl;
  const origin = requestOrigin(req);
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isDevBypassLogin = pathname.startsWith("/api/dev-bypass-login");
  const isPublic =
    isAuthPage ||
    isDevBypassLogin ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/mobile") ||
    pathname.startsWith("/preview") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/privacy");

  // Mint a real session cookie once so forms/Server Actions work through tunnels.
  if (
    bypass &&
    !req.auth &&
    !isDevBypassLogin &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/support") &&
    !pathname.startsWith("/privacy")
  ) {
    const login = new URL("/api/dev-bypass-login", origin);
    login.searchParams.set("next", pathname || "/");
    return NextResponse.redirect(login);
  }

  // Dev bypass: never force the login screen — go straight into the app.
  if (bypass && isAuthPage) {
    return NextResponse.redirect(new URL("/", origin));
  }

  if (!isLoggedIn && !isPublic) {
    // API routes should return 401, not redirect HTML
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
