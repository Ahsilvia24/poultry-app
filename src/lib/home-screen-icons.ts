/** Public files Safari / Android use when saving the site to the home screen. */
export const HOME_SCREEN_ICON_PATHS = [
  "/favicon.ico",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
  "/manifest.json",
  "/sw.js",
  "/offline.html",
] as const;

export function isHomeScreenAsset(pathname: string) {
  if ((HOME_SCREEN_ICON_PATHS as readonly string[]).includes(pathname)) return true;
  if (pathname === "/icon" || pathname.startsWith("/icon?")) return true;
  if (pathname === "/apple-icon" || pathname.startsWith("/apple-icon?")) return true;
  return false;
}
