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
 * Flags:
 *   --out <path>   also write the Markdown digest to a file (for the workflow)
 *   --input <file> read a pre-captured { outdated, audit } JSON instead of running
 *                  npm (used by tests / offline runs)
 *
 * Always exits 0 (`npm outdated`/`npm audit` exit non-zero merely because findings
 * exist — that is normal, not a script failure).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// `npm outdated --json` and `npm audit --json` exit non-zero when they find
// something; capture stdout regardless of exit code. But a REAL failure
// (network/registry/auth) also lands in catch — surface its stderr so the run
// logs show it instead of silently rendering a clean-looking report.
function runNpmJson(args) {
  try {
    return execFileSync("npm", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    if (error.stderr) process.stderr.write(String(error.stderr));
    return error.stdout?.toString() ?? "";
  }
}

function parseJsonSafe(text, fallback) {
  try {
    return text.trim() ? JSON.parse(text) : fallback;
  } catch {
    process.stderr.write(`[dependency-report] warning: failed to parse npm JSON output: ${text.slice(0, 200)}\n`);
    return fallback;
  }
}

function majorOf(version) {
  const m = /^\D*(\d+)/.exec(String(version ?? ""));
  return m ? Number.parseInt(m[1], 10) : null;
}

/**
 * Pure renderer. `outdated` is the `npm outdated --json` object (pkg → {current,
 * wanted, latest}), or `null` when the outdated check itself failed (rendered as
 * "data unavailable" rather than a falsely-clean "none"). `audit` is the
 * `npm audit --json` object. Returns Markdown.
 */
export function renderDependencyReport(outdated, audit) {
  const stamp = new Date().toISOString();
  const lines = [`### Dependency report — ${stamp}`, ""];

  if (outdated == null) {
    lines.push("**Outdated direct dependencies:** data unavailable (npm outdated failed — see run logs).");
  } else if (Object.keys(outdated).length === 0) {
    lines.push("**Outdated direct dependencies:** none 🎉");
  } else {
    const entries = Object.entries(outdated);
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

  const vulns = audit?.metadata?.vulnerabilities;
  lines.push("");
  if (vulns) {
    const { info = 0, low = 0, moderate = 0, high = 0, critical = 0, total = 0 } = vulns;
    lines.push(
      `**Vulnerabilities:** ${total} total — critical ${critical}, high ${high}, moderate ${moderate}, low ${low}, info ${info}`,
    );
  } else {
    lines.push("**Vulnerabilities:** audit data unavailable.");
  }

  lines.push(
    "",
    "_Report only. Run the AGENTS.md `dependency` protocol (compatibility audit + grouped upgrades) to act — never a bulk auto-bump._",
  );
  return lines.join("\n") + "\n";
}

/** Highest severity present, for the workflow to decide whether to notify. */
export function highestSeverity(audit) {
  const v = audit?.metadata?.vulnerabilities ?? {};
  for (const level of ["critical", "high", "moderate", "low"]) {
    if ((v[level] ?? 0) > 0) return level;
  }
  return "none";
}

function main() {
  const inputPath = argValue("--input");
  let outdated;
  let audit;
  if (inputPath) {
    const payload = parseJsonSafe(readFileSync(inputPath, "utf8"), {});
    outdated = payload.outdated ?? {};
    audit = payload.audit ?? {};
  } else {
    outdated = parseJsonSafe(runNpmJson(["outdated", "--json"]), {});
    // Include dev dependencies: the repo's dependency-maintenance protocol covers the
    // dev toolchain (Vitest/Playwright/ESLint), and prod-only high/critical is already
    // gated by the CI safety job's `npm audit --omit=dev --audit-level=high`.
    audit = parseJsonSafe(runNpmJson(["audit", "--json"]), {});
  }

  // A failed `npm outdated --json` can still emit a JSON error payload ({ error: … }) on
  // stdout; treat that as "data unavailable" rather than counting `error` as a package.
  if (outdated && typeof outdated === "object" && "error" in outdated) {
    process.stderr.write(
      `[dependency-report] warning: npm outdated failed: ${JSON.stringify(outdated.error).slice(0, 200)}\n`,
    );
    outdated = null;
  }

  const digest = renderDependencyReport(outdated, audit);
  process.stdout.write(digest);
  const out = argValue("--out");
  if (out) writeFileSync(out, digest);

  if (process.env.GITHUB_OUTPUT) {
    const outdatedCount = Object.keys(outdated ?? {}).length;
    writeFileSync(process.env.GITHUB_OUTPUT, `outdated=${outdatedCount}\nseverity=${highestSeverity(audit)}\n`, {
      flag: "a",
    });
  }
  process.exit(0);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
