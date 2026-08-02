#!/usr/bin/env node
/**
 * trivy-image-scan — vulnerability scan and SBOM generation using a pinned
 * immutable Trivy Docker image. Designed for Linux CI; local runs need a
 * `trivy` binary on PATH or Docker.
 *
 * The Docker fallback exports the target image with `docker save` and mounts
 * only that tar (plus an optional output dir). It never bind-mounts the Docker
 * daemon socket, which would be equivalent to root on the host.
 */
import { basename, dirname, join, resolve } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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

/**
 * @param {string} imageRef
 * @param {string[]} trivyArgs use "__IMAGE__" where the image ref belongs and
 *   "__OUT__" where an output path belongs (when outputHostPath is set)
 * @param {{ outputHostPath?: string | null }} [opts]
 */
function runDockerTrivy(imageRef, trivyArgs, { outputHostPath = null } = {}) {
  const workDir = mkdtempSync(join(tmpdir(), "trivy-scan-"));
  const tarName = "image.tar";
  const tarPath = join(workDir, tarName);
  try {
    const save = run("docker", ["save", "-o", tarPath, imageRef]);
    if (save.status !== 0) {
      return {
        status: 1,
        stdout: save.stdout,
        stderr: save.stderr || save.stdout || `docker save failed for ${imageRef}`,
      };
    }

    const mounts = ["-v", `${workDir}:/work:ro`];
    if (outputHostPath) {
      mounts.push("-v", `${dirname(resolve(outputHostPath))}:/out`);
    }

    const dockerArgs = ["run", "--rm", "--network=none", ...mounts, TRIVY_IMAGE];
    for (const arg of trivyArgs) {
      if (arg === "__IMAGE__") {
        dockerArgs.push("--input", `/work/${tarName}`);
      } else if (arg === "__OUT__" && outputHostPath) {
        dockerArgs.push(`/out/${basename(outputHostPath)}`);
      } else {
        dockerArgs.push(arg);
      }
    }

    return run("docker", dockerArgs);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
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
    const result = trivy
      ? run(trivy, ["image", "--format", "cyclonedx", "--output", out, imageRef])
      : runDockerTrivy(imageRef, ["image", "--format", "cyclonedx", "--output", "__OUT__", "__IMAGE__"], {
          outputHostPath: out,
        });
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      process.exit(1);
    }
    console.log(`SBOM written to ${out}`);
  }

  const result = trivy
    ? run(trivy, ["image", "--format", "json", "--exit-code", "0", "--severity", severity, imageRef])
    : runDockerTrivy(imageRef, ["image", "--format", "json", "--exit-code", "0", "--severity", severity, "__IMAGE__"]);

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
