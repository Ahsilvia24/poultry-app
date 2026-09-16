/** Next.js wraps a finished server action in an RSC/redirect throw on the client. */
export function isActionTransportError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const digest =
    error && typeof error === "object" && "digest" in error
      ? String((error as { digest?: string }).digest)
      : "";
  return (
    digest.includes("NEXT_REDIRECT") ||
    message === "NEXT_REDIRECT" ||
    /server components render|digest property|omitted in production/i.test(message)
  );
}
