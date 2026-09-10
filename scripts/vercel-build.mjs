import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);

const databaseUrl = process.env.DATABASE_URL?.trim();
if (databaseUrl) {
  if (!process.env.DIRECT_URL?.trim()) {
    process.env.DIRECT_URL = databaseUrl;
  }
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.warn(
    "DATABASE_URL is not set. Skipping database migrate. Add DATABASE_URL and DIRECT_URL on Vercel → Settings → Environment Variables (Production), then Redeploy.",
  );
}

run("npx", ["next", "build"]);
