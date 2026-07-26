/**
 * Offline-first: network API helpers are unused.
 * Kept as a thin facade so older imports compile during migration.
 */
export async function saveToken(_token: string) {}
export async function getToken() {
  return null;
}
export async function clearToken() {}

export async function api<T>(_path: string, _options?: RequestInit & { auth?: boolean }): Promise<T> {
  throw new Error("Network API disabled — this build is offline-first.");
}
