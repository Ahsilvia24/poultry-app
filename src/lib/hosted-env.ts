/** Map Vercel/Prisma storage names onto DATABASE_URL + DIRECT_URL. */

const POSTGRES_PREFIX = /^(postgres(ql)?:\/\/)/i;
const PRISMA_PREFIX = /^prisma(\+postgres)?:\/\//i;

function first(env: NodeJS.ProcessEnv, keys: string[]) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function isPostgres(value: string) {
  return POSTGRES_PREFIX.test(value);
}

function isPrismaProtocol(value: string) {
  return PRISMA_PREFIX.test(value);
}

export function applyHostedEnv(env: NodeJS.ProcessEnv = process.env) {
  const postgresUrl = first(env, [
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED",
  ]);
  const prismaDatabaseUrl = first(env, ["PRISMA_DATABASE_URL", "POSTGRES_PRISMA_URL"]);
  const databaseUrl = first(env, ["DATABASE_URL"]);

  const postgresCandidates = [postgresUrl, databaseUrl, prismaDatabaseUrl].filter(isPostgres);
  const anyUrl = databaseUrl || prismaDatabaseUrl || postgresUrl;

  if (!env.DATABASE_URL?.trim() || (isPrismaProtocol(env.DATABASE_URL) && postgresCandidates[0])) {
    env.DATABASE_URL = postgresCandidates[0] || anyUrl;
  }

  if (!env.DIRECT_URL?.trim()) {
    env.DIRECT_URL = postgresCandidates[0] || env.DATABASE_URL || "";
  }

  // Production uses the owned domain. Login still stays on the current host
  // (redirect: false + trustHost). Preview stays on the Vercel URL.
  if (env.VERCEL_ENV === "production" || /poultrytechapp\.com/i.test(env.AUTH_URL ?? "")) {
    env.AUTH_URL = "https://poultrytechapp.com";
  } else if (!env.AUTH_URL?.trim()) {
    if (env.VERCEL_URL?.trim()) {
      env.AUTH_URL = `https://${env.VERCEL_URL.trim()}`;
    } else {
      delete env.AUTH_URL;
    }
  }
  if (/github\.io/i.test(env.AUTH_URL ?? "")) {
    delete env.AUTH_URL;
  }

  if (!env.AUTH_SECRET?.trim()) {
    env.AUTH_SECRET =
      first(env, ["NEXTAUTH_SECRET"]) || `poultrytech:${env.VERCEL_PROJECT_ID || "local"}`;
  }

  return env;
}
