import { spawnSync } from "node:child_process";

const args = ["check", "--node-modules-dir=false", "supabase/functions/indexing-v3-agent/index.ts"];
const deno = spawnSync("deno", ["--version"], { encoding: "utf8" });
const denoVersionLine = deno.stdout?.split("\n")[0]?.trim() ?? "";
const denoVersionMatch = denoVersionLine.match(/^deno\s+(\d+)\./);
const denoMajor = denoVersionMatch ? Number(denoVersionMatch[1]) : null;
const hasDeno = deno.status === 0 && denoMajor !== null && denoMajor >= 2;

if (!hasDeno) {
  const found = deno.status === 0 ? denoVersionLine || "unknown version" : "not installed";
  if (process.env.CI) {
    console.error(
      `[check:edge:functions] Deno v2.x is required in CI (found: ${found}). Install Deno and rerun this check.`,
    );
    process.exit(1);
  }

  console.warn(
    `[check:edge:functions] Deno v2.x is required to run this check locally (found: ${found}); skipping edge function type check. Install Deno v2.x to run this check locally.`,
  );
  process.exit(0);
}

const check = spawnSync("deno", args, { stdio: "inherit" });

if (check.error) {
  console.error(`[check:edge:functions] Failed to execute Deno: ${check.error.message}`);
  process.exit(1);
}

process.exit(check.status ?? 1);
