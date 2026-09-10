const POSTGRES_PREFIX = /^(postgres(ql)?:\/\/)/i;
const PRISMA_PREFIX = /^prisma(\+postgres)?:\/\//i;

function first(env, keys) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function isPostgres(value) {
  return POSTGRES_PREFIX.test(value);
}

function isPrismaProtocol(value) {
  return PRISMA_PREFIX.test(value);
}

export function applyHostedEnv(env = process.env) {
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

  const authUrl = env.AUTH_URL?.trim() ?? "";
  if (!authUrl || /poultrytechapp\.com|github\.io/i.test(authUrl)) {
    if (env.VERCEL_URL?.trim()) {
      env.AUTH_URL = `https://${env.VERCEL_URL.trim()}`;
    } else {
      delete env.AUTH_URL;
    }
  }

  if (!env.AUTH_SECRET?.trim()) {
    env.AUTH_SECRET =
      first(env, ["NEXTAUTH_SECRET"]) || `poultrytech:${env.VERCEL_PROJECT_ID || "local"}`;
  }

  return env;
}
