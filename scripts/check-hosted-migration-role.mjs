#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RESERVED_HOSTED_ROLE = ["supabase", "admin"].join("_");
export const IMMUTABLE_HISTORICAL_MIGRATION = [
  "supabase",
  "migrations",
  `20260713102000_revoke_${RESERVED_HOSTED_ROLE}_default_privileges.sql`,
].join("/");
export const IMMUTABLE_HISTORICAL_SHA256 = "39a5f310f2207aed473b92128dd414d4fd8903d56d5802a3d749f81850cca541";

const GUARDED_EXACT_PATHS = new Set([
  "AGENTS.md",
  "package.json",
  "supabase/schema.sql",
  "supabase/roles.sql",
  "docs/disaster-recovery-runbook.md",
]);
const GUARDED_PATH_PREFIXES = [".github/actions/", ".github/workflows/", "scripts/", "supabase/migrations/"];
const RESERVED_ROLE_PATTERN = new RegExp(
  `(^|[^A-Za-z0-9_])${RESERVED_HOSTED_ROLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^A-Za-z0-9_])`,
  "i",
);

function normalizePath(filePath) {
  return String(filePath).replaceAll("\\", "/").replace(/^\.\//, "");
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function isGuardedMigrationRolePath(filePath) {
  const normalized = normalizePath(filePath);
  return GUARDED_EXACT_PATHS.has(normalized) || GUARDED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function referenceLines(content) {
  return content
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => RESERVED_ROLE_PATTERN.test(line))
    .map(({ lineNumber }) => lineNumber);
}

export function validateMigrationRoleEntries(entries, { requireHistorical = true } = {}) {
  const failures = [];
  let sawHistoricalMigration = false;

  for (const entry of entries) {
    const filePath = normalizePath(entry.path);

    if (filePath === IMMUTABLE_HISTORICAL_MIGRATION) {
      sawHistoricalMigration = true;
      if (entry.content === null || entry.content === undefined) {
        failures.push(`${filePath}: immutable applied migration is missing`);
        continue;
      }
      const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content);
      const actualHash = sha256(content);
      if (actualHash !== IMMUTABLE_HISTORICAL_SHA256) {
        failures.push(
          `${filePath}: immutable applied migration changed (expected SHA-256 ${IMMUTABLE_HISTORICAL_SHA256}, got ${actualHash})`,
        );
      }
      continue;
    }

    if (!isGuardedMigrationRolePath(filePath)) continue;

    if (filePath.toLowerCase().includes(RESERVED_HOSTED_ROLE)) {
      failures.push(`${filePath}: active file name references the reserved hosted role`);
    }

    if (entry.content === null || entry.content === undefined) continue;
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content);
    if (content.includes(0)) continue;
    const lines = referenceLines(content.toString("utf8"));
    if (lines.length > 0) {
      failures.push(
        `${filePath}:${lines.join(",")}: active content references the reserved hosted role; hosted SQL and tooling must use postgres`,
      );
    }
  }

  if (requireHistorical && !sawHistoricalMigration) {
    failures.push(`${IMMUTABLE_HISTORICAL_MIGRATION}: immutable applied migration is missing`);
  }

  return failures;
}

export function repositoryEntries(repoRoot = process.cwd()) {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });

  return output
    .split("\0")
    .filter(Boolean)
    .map((filePath) => ({
      path: normalizePath(filePath),
      content: existsSync(path.join(repoRoot, filePath)) ? readFileSync(path.join(repoRoot, filePath)) : null,
    }));
}

export function validateRepository(repoRoot = process.cwd()) {
  return validateMigrationRoleEntries(repositoryEntries(repoRoot));
}

function main() {
  const failures = validateRepository();
  if (failures.length > 0) {
    console.error("Hosted migration-role guard failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    console.error(
      `Only ${IMMUTABLE_HISTORICAL_MIGRATION} may retain the legacy role reference, and its bytes are pinned. ` +
        "Use role postgres for hosted migrations, schema snapshots, CI, and deployment tooling.",
    );
    process.exit(1);
  }

  console.log(
    "Hosted migration-role guard passed: active hosted SQL/tooling uses postgres and immutable applied history is unchanged.",
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) main();
