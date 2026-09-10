/** Prisma treats `{ userId: undefined }` as “no filter” and returns every farm. */
export function requireUserId(userId: string | undefined | null): string {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new Error("Unauthorized");
  }
  return userId;
}

export function farmOwnedBy(userId: string | undefined | null): {
  userId: string;
  deletedAt: null;
} {
  return { userId: requireUserId(userId), deletedAt: null };
}
