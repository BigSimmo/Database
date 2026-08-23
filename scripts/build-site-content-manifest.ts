import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { allSiteContentRecords } from "../src/lib/site-content/adapters";
import {
  buildStaticSiteContentManifest,
  type StaticSiteContentManifest,
} from "../src/lib/site-content/site-content-manifest";
import { SITE_CONTENT_REGISTRY_VERSION } from "../src/lib/site-content/site-content-registry";

const defaultBaselinePath = "tests/fixtures/site-content/static-manifest-baseline.json";

type CliOptions = {
  check: boolean;
  outPath?: string;
  baselinePath?: string;
  diffPath?: string;
};

function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = { check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--check") {
      options.check = true;
      continue;
    }
    if (token === "--out" || token === "--baseline" || token === "--diff") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${token} requires a path.`);
      if (token === "--out") options.outPath = value;
      if (token === "--baseline") options.baselinePath = value;
      if (token === "--diff") options.diffPath = value;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!options.check && !options.outPath && !options.diffPath) {
    throw new Error("Use --check, --out <path>, or --baseline <path> --diff <path>.");
  }
  if (options.diffPath && !options.baselinePath) throw new Error("--diff requires --baseline <path>.");
  return options;
}

function currentGitSha() {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function readManifest(path: string): StaticSiteContentManifest {
  const parsed = JSON.parse(readFileSync(resolve(path), "utf8")) as StaticSiteContentManifest;
  if (
    parsed.version !== "clinical-kb-site-static-manifest-v1" ||
    !Array.isArray(parsed.records) ||
    !/^[0-9a-f]{64}$/.test(parsed.staticManifestDigest)
  ) {
    throw new Error(`Invalid static site-content manifest: ${path}`);
  }
  return parsed;
}

function writeJson(path: string, value: unknown) {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function manifestDiff(baseline: StaticSiteContentManifest, candidate: StaticSiteContentManifest) {
  const baselineById = new Map(baseline.records.map((record) => [record.logicalId, record] as const));
  const candidateById = new Map(candidate.records.map((record) => [record.logicalId, record] as const));
  const added = [...candidateById.keys()].filter((id) => !baselineById.has(id)).sort();
  const removed = [...baselineById.keys()].filter((id) => !candidateById.has(id)).sort();
  const changed = [...candidateById.entries()]
    .filter(([id, record]) => {
      const previous = baselineById.get(id);
      return (
        previous &&
        (previous.contentHash !== record.contentHash ||
          previous.lineageDigest !== record.lineageDigest ||
          previous.route !== record.route ||
          previous.validationStatus !== record.validationStatus ||
          previous.sourceStatus !== record.sourceStatus ||
          previous.eligible !== record.eligible ||
          previous.exclusionReason !== record.exclusionReason)
      );
    })
    .map(([logicalId]) => logicalId)
    .sort();
  return {
    version: "clinical-kb-site-static-manifest-diff-v1",
    baselineDigest: baseline.staticManifestDigest,
    candidateDigest: candidate.staticManifestDigest,
    added,
    removed,
    changed,
    unchanged: added.length === 0 && removed.length === 0 && changed.length === 0,
  };
}

function summary(manifest: StaticSiteContentManifest) {
  const domains = Object.fromEntries(
    [...new Set(manifest.records.map((record) => record.domain))]
      .sort()
      .map((domain) => [domain, manifest.records.filter((record) => record.domain === domain).length]),
  );
  return {
    version: manifest.version,
    registryVersion: manifest.registryVersion,
    recordCount: manifest.records.length,
    eligibleCount: manifest.records.filter((record) => record.eligible).length,
    staticManifestDigest: manifest.staticManifestDigest,
    domains,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidate = buildStaticSiteContentManifest(allSiteContentRecords, {
    gitSha: currentGitSha(),
    registryVersion: SITE_CONTENT_REGISTRY_VERSION,
  });
  if (options.outPath) writeJson(options.outPath, candidate);

  const baselinePath = options.baselinePath ?? (options.check ? defaultBaselinePath : undefined);
  let diff: ReturnType<typeof manifestDiff> | undefined;
  if (baselinePath) {
    diff = manifestDiff(readManifest(baselinePath), candidate);
    if (options.diffPath) writeJson(options.diffPath, diff);
  }
  if (options.check && !diff?.unchanged) {
    throw new Error(`Static site-content manifest differs from ${baselinePath}.`);
  }
  console.log(
    JSON.stringify({
      status: options.check ? "checked" : "built",
      ...summary(candidate),
      ...(diff
        ? {
            baselineDigest: diff.baselineDigest,
            addedCount: diff.added.length,
            removedCount: diff.removed.length,
            changedCount: diff.changed.length,
          }
        : {}),
      ...(options.outPath ? { output: options.outPath } : {}),
      ...(options.diffPath ? { diffOutput: options.diffPath } : {}),
    }),
  );
}

main();
