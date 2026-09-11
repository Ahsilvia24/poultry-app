/** JSON-safe clone. Dates become ISO strings. */
export function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
