import { NextResponse } from "next/server";
import { auth, isAuthDevBypassEnabled } from "@/lib/auth";

export default auth((req) => {
  const bypass = isAuthDevBypassEnabled();
  const isLoggedIn = !!req.auth || bypass;
  const { pathname } = req.nextUrl;
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
    const login = new URL("/api/dev-bypass-login", req.nextUrl.origin);
    login.searchParams.set("next", pathname || "/");
    return NextResponse.redirect(login);
  }

  // Dev bypass: never force the login screen — go straight into the app.
  if (bypass && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (!isLoggedIn && !isPublic) {
    // API routes should return 401, not redirect HTML
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
