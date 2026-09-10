import { spawnSync } from "node:child_process";
import path from "node:path";
import { applyHostedEnv } from "./hosted-env.mjs";

applyHostedEnv();

const bin = (name) => path.join(process.cwd(), "node_modules", ".bin", name);

function run(command, args, { allowFail = false } = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0 && !allowFail) {
    process.exit(result.status ?? 1);
  }
  return result.status ?? 1;
}

function isPostgresUrl(value) {
  return /^(postgres(ql)?:\/\/)/i.test(value?.trim() ?? "");
}

run(bin("prisma"), ["generate"]);

const migrateUrl = isPostgresUrl(process.env.DIRECT_URL)
  ? process.env.DIRECT_URL
  : isPostgresUrl(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL
    : "";

if (migrateUrl) {
  process.env.DIRECT_URL = migrateUrl;
  const migrateStatus = run(bin("prisma"), ["migrate", "deploy"], { allowFail: true });
  if (migrateStatus !== 0) {
    console.warn(
      "prisma migrate deploy failed. Continuing with next build. Check POSTGRES_URL is a postgres:// string.",
    );
  }
} else {
  console.warn(
    "No postgres:// URL on POSTGRES_URL, DATABASE_URL, or PRISMA_DATABASE_URL. Skipping migrate.",
  );
}

run(bin("next"), ["build"]);
