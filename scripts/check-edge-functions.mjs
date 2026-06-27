import { spawnSync } from "node:child_process";

const args = ["check", "--node-modules-dir=false", "supabase/functions/indexing-v3-agent/index.ts"];
const deno = spawnSync("deno", ["--version"], { stdio: "ignore" });
const hasDeno = deno.status === 0;

if (!hasDeno) {
  if (process.env.CI) {
    console.error("[check:edge:functions] Deno v2.x is required in CI. Install Deno and rerun this check.");
    process.exit(1);
  }

  console.warn(
    "[check:edge:functions] Deno v2.x is not installed locally; skipping edge function type check. Install Deno to run this check locally.",
  );
  process.exit(0);
}

const check = spawnSync("deno", args, { stdio: "inherit" });

if (check.error) {
  console.error(`[check:edge:functions] Failed to execute Deno: ${check.error.message}`);
  process.exit(1);
}

process.exit(check.status ?? 1);
