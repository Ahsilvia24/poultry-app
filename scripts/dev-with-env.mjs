import { spawn } from "node:child_process";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

const args = process.argv.slice(2);
const child = spawn(
  process.execPath,
  [resolve(process.cwd(), "node_modules/next/dist/bin/next"), "dev", ...args],
  {
    stdio: "inherit",
    env: process.env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
