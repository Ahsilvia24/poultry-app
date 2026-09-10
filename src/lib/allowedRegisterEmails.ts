/**
 * Emails allowed to create a PoultryTech account.
 * Add lowercase addresses here when more techs should be able to register.
 * Optional env `ALLOWED_REGISTER_EMAILS` (comma-separated) appends more without a code change.
 */
export const ALLOWED_REGISTER_EMAILS = [
  "tech@poultry.local",
  "alexsilvia24@yahoo.com",
] as const;

function extraAllowedEmails() {
  return (process.env.ALLOWED_REGISTER_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isRegisterEmailAllowed(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if ((ALLOWED_REGISTER_EMAILS as readonly string[]).includes(normalized)) return true;
  const devEmail = (process.env.AUTH_DEV_USER_EMAIL ?? "").trim().toLowerCase();
  if (devEmail && normalized === devEmail) return true;
  return extraAllowedEmails().includes(normalized);
}
