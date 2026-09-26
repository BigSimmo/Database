// Weekly report section: map hygiene (organisation framework suggestion 4). It runs the
// organisation checker as a subprocess, in its working-tree mode with no report files, and lists
// what the map has not caught up with: unplaced files, entries left behind by a move or deletion,
// the not-yet-placed list, and anything else the checker flagged. Leftovers already on main are
// reported here weekly rather than blamed on the next pull request.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CHECKER_SCRIPT, inlineCode, oneLine } from "../weekly-lib.mjs";

export const FIX_COMMAND = "npm run check:organisation -- --fix";
const NOT_YET_PLACED = "docs/organisation/not-yet-placed.json";
const LIST_MAX = 50;
// Finding keys (the text before the first colon) for entries that point at a moved or deleted
// file, or a not-yet-placed entry a rule now covers. `--fix` removes every one of these.
const STALE_KINDS = new Set([
  "dead-rule",
  "dead-shared",
  "dead-nyp",
  "dead-list",
  "dead-canonical",
  "dead-pin",
  "nyp-superseded",
]);

/** Runs the checker on `root` and returns its JSON report (the same one `--json` prints). */
export function runChecker(root, { timeoutMs = 120_000 } = {}) {
  const env = { ...process.env };
  // The weekly run judges the whole working tree, never a PR diff, and writes no job summary.
  delete env.ORGANISATION_CHECK_MODE;
  delete env.GITHUB_STEP_SUMMARY;
  const result = spawnSync(process.execPath, [CHECKER_SCRIPT, "--root", root, "--json", "--no-report"], {
    encoding: "utf8",
    env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
  });
  if (result.error) throw new Error(`the organisation checker could not run: ${result.error.message}`);
  const out = result.stdout ?? "";
  const start = out.indexOf("{");
  const end = out.lastIndexOf("}");
  if (start === -1 || end < start)
    throw new Error(`the organisation checker printed no report (exit ${result.status})`);
  return JSON.parse(out.slice(start, end + 1));
}

const kindOf = (finding) => String(finding?.key ?? "").split(":")[0];

function list(items, render, more) {
  if (!items.length) return ["None."];
  const lines = items.slice(0, LIST_MAX).map(render);
  if (items.length > LIST_MAX) lines.push(`- …and ${items.length - LIST_MAX} more; ${more}`);
  return lines;
}

function readNotYetPlaced(root) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(root, NOT_YET_PLACED), "utf8"));
    return Array.isArray(data?.entries) ? data.entries.filter((entry) => typeof entry?.path === "string") : [];
  } catch {
    return null;
  }
}

/** Renders the section from a checker report and the not-yet-placed entries. Exported for tests. */
export function renderMapHygiene(report, notYetPlaced) {
  const findings = Array.isArray(report?.findings) ? report.findings : [];
  const unplaced = findings.filter((finding) => kindOf(finding) === "unplaced");
  const stale = findings.filter((finding) => STALE_KINDS.has(kindOf(finding)));
  const problems = findings.filter((finding) => kindOf(finding) !== "unplaced" && !STALE_KINDS.has(kindOf(finding)));
  const t = report?.totals ?? {};
  const number = (value) => (typeof value === "number" ? value.toLocaleString("en-AU") : "?");
  const more = "run `npm run check:organisation` for the full list.";
  const lines = [
    `Checker result: **exit ${report?.exitCode ?? "?"} (${oneLine(report?.verdict ?? "unknown", 40)})** on the ${oneLine(report?.scope ?? "working tree", 60)}${report?.commit ? ` at ${inlineCode(String(report.commit).slice(0, 12))}` : ""}.`,
  ];
  if (report?.incomplete) lines.push("", `The checker could not finish: ${oneLine(report.incomplete, 300)}`);
  if (t.files !== undefined) {
    lines.push(
      "",
      `${number(t.files)} tracked files: ${number(t.placed)} placed, ${number(t.shared)} shared, ${number(t.ignored)} ignored, ${number(t.notYetPlaced)} not yet placed, ${number(t.unplaced)} unplaced.`,
    );
  }
  lines.push(
    "",
    `### Unplaced files (${unplaced.length})`,
    "",
    ...(unplaced.length ? ["No rule places these yet. See the suggested homes for proposals.", ""] : []),
    ...list(unplaced, (finding) => `- ${inlineCode(finding.subject)}`, more),
    "",
    `### Stale entries (${stale.length})`,
    "",
    ...list(stale, (finding) => `- ${inlineCode(finding.subject)}: ${oneLine(finding.message)}`, more),
    "",
    `### Not yet placed (${notYetPlaced === null ? "list unreadable" : notYetPlaced.length})`,
    "",
    ...(notYetPlaced === null
      ? [`${inlineCode(NOT_YET_PLACED)} could not be read; the problems below say why.`]
      : list(notYetPlaced, (entry) => `- ${inlineCode(entry.path)}: ${oneLine(entry.reason ?? "", 160)}`, more)),
    "",
    `### Map problems (${problems.length})`,
    "",
    ...list(
      problems,
      (finding) =>
        `- ${finding.level === "broken" ? "**map broken**" : "warning"} ${inlineCode(finding.subject)}: ${oneLine(finding.message)}`,
      more,
    ),
    "",
    "After moving or renaming files, tidy the map in one step. In a terminal at the repository root, run:",
    "",
    "```bash",
    FIX_COMMAND,
    "```",
    "",
    "It removes entries left pointing at moved or deleted files, drops not-yet-placed entries a rule now covers and puts rules back in alphabetical order. It never places a file and never edits anything outside `docs/organisation/`.",
  );
  return lines.join("\n");
}

export async function section({ root }) {
  return { title: "Map hygiene", markdown: renderMapHygiene(runChecker(root), readNotYetPlaced(root)) };
}
