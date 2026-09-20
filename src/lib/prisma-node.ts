/** Offline-only. Vercel functions do not load a Postgres adapter or query engine. */
export async function getNodePrisma(): Promise<never> {
  throw new Error("No database");
}
