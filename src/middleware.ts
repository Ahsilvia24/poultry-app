import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, isAuthDevBypassEnabled } from "@/lib/auth";

/** Prefer tunnel/proxy host so redirects work outside localhost. */
function requestOrigin(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost.split(",")[0].trim()}`;
  }
  const host = req.headers.get("host");
  if (host && !host.startsWith("0.0.0.0") && !host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
    const proto = forwardedProto ?? (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return req.nextUrl.origin;
}

export default auth((req) => {
  const bypass = isAuthDevBypassEnabled();
  const isLoggedIn = !!req.auth || bypass;
  const { pathname } = req.nextUrl;
  const origin = requestOrigin(req);
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isDevBypassLogin = pathname.startsWith("/api/dev-bypass-login");
  const isPwaAsset =
    pathname === "/manifest.webmanifest" ||
    pathname === "/chick-icon.png" ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon");
  const isPublic =
    isAuthPage ||
    isDevBypassLogin ||
    isPwaAsset ||
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
    !isPwaAsset &&
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|chick-icon.png|manifest.webmanifest|icon.png|apple-icon.png).*)"],
};
