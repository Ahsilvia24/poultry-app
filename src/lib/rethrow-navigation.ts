/** Next.js `redirect` / `notFound` throw; do not swallow them in Prisma fallbacks. */
export function rethrowNavigation(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    /NEXT_REDIRECT|NEXT_NOT_FOUND/.test((error as { digest: string }).digest)
  ) {
    throw error;
  }
}
