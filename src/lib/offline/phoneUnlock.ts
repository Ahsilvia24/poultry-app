import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";

const UNLOCK_KEY = "poultrytech-unlocked-email";

export function unlockPhoneOwner(email: string) {
  try {
    sessionStorage.setItem(UNLOCK_KEY, normalizeOwnerEmail(email));
  } catch {
    /* Private mode can block sessionStorage. Login still set the cookie. */
  }
}

export function lockPhoneOwner() {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* Best-effort. */
  }
}

export function unlockedPhoneOwner() {
  try {
    return normalizeOwnerEmail(sessionStorage.getItem(UNLOCK_KEY) ?? "");
  } catch {
    return "";
  }
}
