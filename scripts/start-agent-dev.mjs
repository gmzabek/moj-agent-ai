import { openSync } from "node:fs";
import { spawn } from "node:child_process";

const out = openSync("agent-dev.log", "a");
const err = openSync("agent-dev.err.log", "a");

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "-p", "3001"],
  {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", out, err],
  },
);

child.unref();
console.log(child.pid);
