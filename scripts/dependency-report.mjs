#!/usr/bin/env node
/**
 * dependency-report — render a digest of outdated direct dependencies and audit
 * vulnerabilities. REPORTS ONLY; it never updates anything.
 *
 * This repo's `dependency` maintenance is a careful, judgment-heavy protocol
 * (compatibility audit, grouped upgrades — see AGENTS.md), never an unattended
 * bulk-bump. So the cron just surfaces drift + vulnerabilities proactively; a
 * human/agent then runs the real protocol. Reads only npm registry metadata.
 *
 * EVERY CHECK CAN SAY "I DO NOT KNOW". The three questions this report answers are
 * separate: did the measurement execute, did it find anything, and is its evidence
 * publishable? Collapsing the first into the second is how a failed run published
 * "none 🎉" and `severity=none` — see scripts/lib/dependency-report-capture.mjs for
 * the full reasoning. Unknown renders as unavailable and emits `severity=unknown`,
 * never as a clean result.
 *
 * Flags:
 *   --out <path>   also write the Markdown digest to a file (for the workflow)
 *   --input <file> read a pre-captured { outdated, audit } JSON instead of running
 *                  npm (used by tests / offline runs). Validated identically to
 *                  real npm output — a fixture gets no easier path than production.
 *
 * Always exits 0 (`npm outdated`/`npm audit` exit non-zero merely because findings
 * exist — that is normal, not a script failure). An unavailable measurement is
 * reported through the digest and the workflow outputs, and the workflow's own
 * evidence gate is what fails the run.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  classifyAuditCapture,
  classifyFixturePayload,
  classifyOutdatedCapture,
} from "./lib/dependency-report-capture.mjs";

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// `npm outdated --json` and `npm audit --json` exit non-zero when they find
// something; capture stdout regardless of exit code. But a REAL failure
// (network/registry/auth) also lands in catch — surface its stderr so the run
// logs show it, AND return the exit status/signal so the classifier can tell an
// empty successful run from an empty failed one. Returning only the string is
// what made those two indistinguishable.
function runNpmJson(args) {
  try {
    const stdout = execFileSync("npm", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { stdout, status: 0, signal: null, failed: false };
  } catch (error) {
    if (error.stderr) process.stderr.write(String(error.stderr));
    return {
      stdout: error.stdout?.toString() ?? "",
      status: typeof error.status === "number" ? error.status : null,
      signal: error.signal ?? null,
      failed: true,
    };
  }
}

function majorOf(version) {
  const m = /^\D*(\d+)/.exec(String(version ?? ""));
  return m ? Number.parseInt(m[1], 10) : null;
}

/** Human sentence for why a measurement is missing. Never embeds stderr or credentials. */
const REASON_TEXT = {
  process_failed: "the npm command failed",
  timeout: "the npm command was killed before it finished",
  malformed_json: "npm produced output that is not valid JSON",
  invalid_shape: "npm produced JSON that does not match the expected shape",
  npm_error_payload: "npm reported an error instead of a result",
};

function reasonText(result) {
  return REASON_TEXT[result?.reasonCode] ?? "the measurement did not complete";
}

/**
 * @typedef {object} CaptureProvenance
 * @property {string} capturedAt
 * @property {string} nodeVersion
 * @property {string | null} commitSha
 * @property {string | null} lockfileSha256
 * @property {string} scope
 */

/**
 * Provenance for the measurement itself. This answers "was this report produced,
 * and from what" independently of what it found — the distinction the whole
 * module exists for. Deliberately excludes registry URLs and auth configuration.
 *
 * @param {Record<string, string | undefined>} [env]
 * @param {() => string | Buffer} [readLockfile]
 * @returns {CaptureProvenance}
 */
export function captureProvenance(env = process.env, readLockfile = () => readFileSync("package-lock.json")) {
  let lockfileSha256 = null;
  try {
    lockfileSha256 = createHash("sha256").update(readLockfile()).digest("hex").slice(0, 16);
  } catch {
    lockfileSha256 = null;
  }
  return {
    capturedAt: new Date().toISOString(),
    nodeVersion: process.version,
    commitSha: env.GITHUB_SHA ?? null,
    lockfileSha256,
    scope: "direct dependencies (outdated) and the full tree including dev (audit)",
  };
}

/**
 * Pure renderer. Both arguments are classified results from
 * scripts/lib/dependency-report-capture.mjs: `{ state, value, reasonCode? }` where
 * state is "ok" | "findings" | "unavailable". Passing raw npm objects is no longer
 * supported, deliberately — the ambiguity between an empty object and an absent
 * measurement is the defect this signature removes. Returns Markdown.
 *
 * @param {{state: string, value: any, reasonCode?: string}} outdatedResult
 * @param {{state: string, value: any, reasonCode?: string}} auditResult
 * @param {CaptureProvenance | null} [provenance]
 * @returns {string}
 */
export function renderDependencyReport(outdatedResult, auditResult, provenance = null) {
  const stamp = new Date().toISOString();
  const lines = [`### Dependency report — ${stamp}`, ""];

  if (outdatedResult?.state === "unavailable") {
    lines.push(
      `**Outdated direct dependencies:** measurement unavailable — ${reasonText(outdatedResult)}. ` +
        "This is **not** evidence that dependencies are current; see the run logs.",
    );
  } else if (Object.keys(outdatedResult?.value ?? {}).length === 0) {
    lines.push("**Outdated direct dependencies:** none 🎉");
  } else {
    const entries = Object.entries(outdatedResult.value);
    const majors = entries.filter(([, v]) => {
      const cur = majorOf(v.current);
      const latest = majorOf(v.latest);
      return cur != null && latest != null && latest > cur;
    });
    lines.push(`**Outdated direct dependencies:** ${entries.length} (${majors.length} major)`, "");
    lines.push("| package | current | wanted | latest | major? |", "| --- | --- | --- | --- | --- |");
    for (const [name, v] of entries.sort((a, b) => a[0].localeCompare(b[0]))) {
      const isMajor = majorOf(v.latest) != null && majorOf(v.current) != null && majorOf(v.latest) > majorOf(v.current);
      lines.push(
        `| ${name} | ${v.current ?? "?"} | ${v.wanted ?? "?"} | ${v.latest ?? "?"} | ${isMajor ? "⚠ yes" : "—"} |`,
      );
    }
  }

  lines.push("");
  if (auditResult?.state === "unavailable") {
    lines.push(
      `**Vulnerabilities:** measurement unavailable — ${reasonText(auditResult)}. ` +
        "Counts are unknown, **not** zero.",
    );
  } else {
    const { info, low, moderate, high, critical, total } = auditResult.value.metadata.vulnerabilities;
    lines.push(
      `**Vulnerabilities:** ${total} total — critical ${critical}, high ${high}, moderate ${moderate}, low ${low}, info ${info}`,
    );
  }

  if (provenance) {
    lines.push(
      "",
      `_Measured ${provenance.capturedAt} on Node ${provenance.nodeVersion}` +
        (provenance.commitSha ? ` at \`${provenance.commitSha.slice(0, 12)}\`` : "") +
        (provenance.lockfileSha256 ? `, lockfile \`${provenance.lockfileSha256}\`` : "") +
        `. Scope: ${provenance.scope}._`,
    );
  }

  lines.push(
    "",
    "_Report only. Run the AGENTS.md `dependency` protocol (compatibility audit + grouped upgrades) to act — never a bulk auto-bump._",
  );
  return lines.join("\n") + "\n";
}

/**
 * Highest severity present, for the workflow to decide whether to notify.
 *
 * Returns "unknown" when the audit did not produce a validated observation. That
 * value is deliberately NOT "none": the workflow's evidence gate fails on it,
 * where "none" would have published a missing measurement as a clean one.
 *
 * @param {{state: string, value: any}} auditResult
 * @returns {"unknown" | "none" | "low" | "moderate" | "high" | "critical"}
 */
export function highestSeverity(auditResult) {
  if (auditResult?.state === "unavailable") return "unknown";
  const v = auditResult?.value?.metadata?.vulnerabilities;
  if (!v) return "unknown";
  for (const level of ["critical", "high", "moderate", "low"]) {
    if ((v[level] ?? 0) > 0) return level;
  }
  return "none";
}

function main() {
  const inputPath = argValue("--input");
  let outdatedResult;
  let auditResult;
  if (inputPath) {
    let text = "";
    try {
      text = readFileSync(inputPath, "utf8");
    } catch (error) {
      process.stderr.write(`[dependency-report] warning: cannot read --input ${inputPath}: ${error.code ?? "error"}\n`);
    }
    ({ outdated: outdatedResult, audit: auditResult } = classifyFixturePayload(text));
  } else {
    outdatedResult = classifyOutdatedCapture(runNpmJson(["outdated", "--json"]));
    // Include dev dependencies: the repo's dependency-maintenance protocol covers the
    // dev toolchain (Vitest/Playwright/ESLint), and prod-only high/critical is already
    // gated by the CI safety job's `npm audit --omit=dev --audit-level=high`.
    auditResult = classifyAuditCapture(runNpmJson(["audit", "--json"]));
  }

  for (const [name, result] of [
    ["outdated", outdatedResult],
    ["audit", auditResult],
  ]) {
    if (result.state === "unavailable") {
      process.stderr.write(`[dependency-report] warning: ${name} measurement unavailable (${result.reasonCode})\n`);
    }
  }

  const provenance = captureProvenance();
  const digest = renderDependencyReport(outdatedResult, auditResult, provenance);
  process.stdout.write(digest);
  const out = argValue("--out");
  if (out) writeFileSync(out, digest);

  if (process.env.GITHUB_OUTPUT) {
    // `outdated` stays a plain integer only when it was actually measured. An
    // unavailable check emits the string `unknown`, because the previous
    // `Object.keys(outdated ?? {}).length` turned the one genuine unavailability
    // sentinel back into a reassuring 0 before the workflow ever saw it.
    const outdatedCount = outdatedResult.state === "unavailable" ? "unknown" : Object.keys(outdatedResult.value).length;
    const evidenceComplete = outdatedResult.state !== "unavailable" && auditResult.state !== "unavailable";
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `outdated=${outdatedCount}`,
        `severity=${highestSeverity(auditResult)}`,
        `outdated_state=${outdatedResult.state}`,
        `audit_state=${auditResult.state}`,
        `evidence_complete=${evidenceComplete}`,
        "",
      ].join("\n"),
      { flag: "a" },
    );
  }
  process.exit(0);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
