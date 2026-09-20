import { spawnSync } from "node:child_process";
import path from "node:path";
import { applyHostedEnv } from "./hosted-env.mjs";

applyHostedEnv();

const bin = (name) => path.join(process.cwd(), "node_modules", ".bin", name);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(bin("next"), ["build"]);
