#!/usr/bin/env node
/**
 * Local design-sync prep: install gitignored `.ds-sync` toolchain deps, then
 * compile Tailwind into `.design-sync/.cache/compiled.css` via config.buildCmd.
 *
 * Full remote upload to claude.ai/design (`resync.mjs --remote`) lives outside
 * this repo (session skill). This script covers the friction that burned
 * ledger #110/#141 triage time: missing `.ds-sync` packages and a stale CSS
 * bundle. See `.design-sync/NOTES.md`.
 *
 * Usage: node scripts/design-sync.mjs
 *        node scripts/design-sync.mjs --skip-install
 *        node scripts/design-sync.mjs --dry-run
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipInstall = process.argv.includes("--skip-install");
const dryRun = process.argv.includes("--dry-run");
const dsSyncDir = path.join(projectRoot, ".ds-sync");
const cacheDir = path.join(projectRoot, ".design-sync", ".cache");
const configPath = path.join(projectRoot, ".design-sync", "config.json");

const DS_SYNC_PACKAGES = ["esbuild", "ts-morph", "@types/react", "@tailwindcss/cli", "geist"];

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: node scripts/design-sync.mjs [options]

Installs the gitignored .ds-sync toolchain (${DS_SYNC_PACKAGES.join(", ")})
and compiles src/app/globals.css into .design-sync/.cache/compiled.css via
@tailwindcss/cli, then appends .design-sync/font-vars.css.

  --skip-install   reuse an already-populated .ds-sync (no npm install)
  --dry-run        print the planned actions and exit without running them
  --help, -h       show this help and exit

Remote claude.ai/design upload (resync.mjs --remote) is a session skill outside
this repo — see .design-sync/NOTES.md.`);
  process.exit(0);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  if (!fs.existsSync(configPath)) {
    console.error(`Missing ${path.relative(projectRoot, configPath)}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (typeof config.buildCmd !== "string" || !config.buildCmd.trim()) {
    console.error("`.design-sync/config.json` has no buildCmd");
    process.exit(1);
  }

  if (dryRun) {
    console.log("[design-sync] --dry-run: would perform:");
    if (skipInstall) {
      console.log("[design-sync]   (skip) npm install --prefix .ds-sync (--skip-install)");
    } else {
      console.log(
        `[design-sync]   npm install --prefix .ds-sync --no-save --package-lock=false ${DS_SYNC_PACKAGES.join(" ")}`,
      );
    }
    console.log("[design-sync]   compile src/app/globals.css -> .design-sync/.cache/compiled.css via @tailwindcss/cli");
    console.log("[design-sync]   append .design-sync/font-vars.css when present");
    process.exit(0);
  }

  fs.mkdirSync(dsSyncDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  if (!skipInstall) {
    console.log("[design-sync] Installing .ds-sync toolchain (gitignored)…");
    run("npm", ["install", "--prefix", ".ds-sync", "--no-save", "--package-lock=false", ...DS_SYNC_PACKAGES], {
      shell: true,
    });
  } else {
    console.log("[design-sync] Skipping .ds-sync install (--skip-install)");
  }

  const twCli = path.join(dsSyncDir, "node_modules", "@tailwindcss", "cli", "dist", "index.mjs");
  if (!fs.existsSync(twCli)) {
    console.error(`[design-sync] Missing ${path.relative(projectRoot, twCli)}. Re-run without --skip-install.`);
    process.exit(1);
  }

  console.log("[design-sync] Compiling CSS via config.buildCmd…");
  // buildCmd is authored for POSIX `cat >>`; on Windows use Node to append fonts.
  const compiledCss = path.join(cacheDir, "compiled.css");
  const fontVars = path.join(projectRoot, ".design-sync", "font-vars.css");
  run(process.execPath, [twCli, "-i", path.join(projectRoot, "src", "app", "globals.css"), "-o", compiledCss]);
  if (fs.existsSync(fontVars)) {
    fs.appendFileSync(compiledCss, fs.readFileSync(fontVars));
  }

  console.log(`[design-sync] Wrote ${path.relative(projectRoot, compiledCss)}`);
  console.log(
    "[design-sync] Local CSS bundle ready. Remote claude.ai/design upload still uses the session design-sync skill (`resync.mjs --remote`).",
  );
  console.log(
    "[design-sync] Accepted noise: [TOKENS_MISSING] for runtime-set tokens — see .design-sync/NOTES.md. Do not “fix” those.",
  );
}

main();
