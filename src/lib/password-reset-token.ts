import { createHash, randomBytes } from "node:crypto";

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createResetToken() {
  return randomBytes(32).toString("hex");
}
