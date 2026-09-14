/** Auth.js names the JWT cookie `*session-token`. */
export function cookieNamesHaveSessionToken(names: string[]) {
  return names.some((name) => name.includes("session-token"));
}

export function cookieHeaderHasSessionToken(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => part.trim().split("=")[0]?.includes("session-token"));
}
