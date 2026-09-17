#!/usr/bin/env node
/**
 * scripts/deploy/write-migration-manifest.mjs
 *
 * Writes deploy/expected-migrations.json — the list of migration versions this
 * build's tree expects to exist in live migration history before the app or
 * worker code built from it starts serving traffic.
 *
 * Run at Docker build time (see Dockerfile / Dockerfile.worker), because
 * `supabase/migrations` is only available in the build context, not in the
 * slim runtime image. The manifest and this file's sibling
 * `migration-versions.mjs` are then copied into the runner stage so
 * `scripts/deploy/await-migrations.mjs` can read them at deploy time without
 * the full repository tree.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { listLocalMigrationVersions } from "./migration-versions.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

export const DEFAULT_MIGRATIONS_DIR = join(REPO_ROOT, "supabase", "migrations");
export const DEFAULT_MANIFEST_PATH = join(REPO_ROOT, "deploy", "expected-migrations.json");

/**
 * @param {string} [migrationsDir]
 * @returns {{ versions: string[], count: number }}
 */
export function buildManifest(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  const versions = listLocalMigrationVersions(migrationsDir);
  return { versions, count: versions.length };
}

/**
 * @param {{ migrationsDir?: string, manifestPath?: string }} [options]
 * @returns {{ versions: string[], count: number }}
 */
export function writeManifest({ migrationsDir = DEFAULT_MIGRATIONS_DIR, manifestPath = DEFAULT_MANIFEST_PATH } = {}) {
  const manifest = buildManifest(migrationsDir);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

const invokedDirectly = process.argv[1] && /write-migration-manifest\.mjs$/.test(process.argv[1]);
if (invokedDirectly) {
  const manifest = writeManifest();
  console.log(`[deploy-migration-gate] wrote ${DEFAULT_MANIFEST_PATH} with ${manifest.count} migration version(s).`);
}
