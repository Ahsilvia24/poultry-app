export function normalizeOwnerEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isOwnerEmail(email: string) {
  const normalized = normalizeOwnerEmail(email);
  return normalized.includes("@");
}
