export function looksLikeEmail(value: string) {
  return /@/.test(value.trim());
}

/** The name they typed. Never treat an email as a person’s name. */
export function pickPersonName(...candidates: Array<string | null | undefined>) {
  for (const value of candidates) {
    const name = String(value ?? "").trim();
    if (name && !looksLikeEmail(name)) return name;
  }
  return "";
}
