#!/usr/bin/env node
/**
 * trivy-image-scan — vulnerability scan and SBOM generation using a pinned
 * immutable Trivy Docker image. Designed for Linux CI; local runs need a
 * `trivy` binary on PATH or Docker exposing the daemon socket.
 */
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

// Pin to a multi-platform image index digest. Update with:
//   node scripts/resolve-oci-image-digest.mjs aquasec/trivy:0.59.1
const TRIVY_IMAGE = "aquasec/trivy:0.59.1@sha256:029e990b328d149bf0a9ffe355919041e1f86192db2df47e217f8a36dd42ceac";

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", stdio: "pipe", ...opts });
  if (result.error) throw result.error;
  return result;
}

function localTrivy() {
  const result = run(process.platform === "win32" ? "where" : "which", ["trivy"]);
  return result.stdout?.split(/\r?\n/)[0]?.trim() || null;
}

function main() {
  const [imageRef, ...rest] = process.argv.slice(2);
  if (!imageRef) {
    console.error("Usage: node scripts/trivy-image-scan.mjs <image:tag> [--severity SEV] [--sbom <output.json>]");
    process.exit(1);
  }

  const sbomIndex = rest.indexOf("--sbom");
  const sbomPath = sbomIndex >= 0 ? rest[sbomIndex + 1] : null;
  const severityIdx = rest.indexOf("--severity");
  const severity = severityIdx >= 0 ? rest[severityIdx + 1] : "HIGH,CRITICAL";

  const trivy = localTrivy();

  if (sbomPath) {
    const out = resolve(sbomPath);
    const sbomArgs = trivy
      ? [trivy, "image", "--format", "cyclonedx", "--output", out, imageRef]
      : [
          "docker",
          "run",
          "--rm",
          "-v",
          "/var/run/docker.sock:/var/run/docker.sock",
          "-v",
          `${dirname(out)}:/out`,
          TRIVY_IMAGE,
          "image",
          "--format",
          "cyclonedx",
          "--output",
          `/out/${basename(out)}`,
          imageRef,
        ];
    const result = run(sbomArgs[0], sbomArgs.slice(1), { cwd: process.cwd() });
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      process.exit(1);
    }
    console.log(`SBOM written to ${out}`);
  }

  const scanArgs = trivy
    ? [trivy, "image", "--format", "json", "--exit-code", "0", "--severity", severity, imageRef]
    : [
        "docker",
        "run",
        "--rm",
        "-v",
        "/var/run/docker.sock:/var/run/docker.sock",
        TRIVY_IMAGE,
        "image",
        "--format",
        "json",
        "--exit-code",
        "0",
        "--severity",
        severity,
        imageRef,
      ];

  const result = run(scanArgs[0], scanArgs.slice(1), { cwd: process.cwd() });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || `Trivy failed to scan ${imageRef}`);
    process.exit(1);
  }

  let summary = null;
  try {
    const report = JSON.parse(result.stdout || "{}");
    const results = report.Results || [];
    const vulnerabilities = results.flatMap((r) => r.Vulnerabilities || []);
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
    for (const v of vulnerabilities) {
      counts[v.Severity ?? "UNKNOWN"] = (counts[v.Severity ?? "UNKNOWN"] ?? 0) + 1;
    }
    summary = `vulnerabilities=${vulnerabilities.length} (${Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([sev, n]) => `${sev}=${n}`)
      .join(", ")})`;
  } catch {
    summary = "could not parse Trivy JSON";
  }

  console.log(`Trivy scan completed for ${imageRef}: ${summary}`);
}

main();
