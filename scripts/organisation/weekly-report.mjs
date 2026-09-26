#!/usr/bin/env node
// Organisation weekly report: one Markdown report built from section modules in
// scripts/organisation/weekly/<name>.mjs. Each module exports
//   async function section({ root, now }) -> { title, markdown }
// where `root` is the repository root and `now` is a Date (injected, so nothing depends on the
// clock). Sections load in the fixed order below. A missing module is skipped and named in the
// footer; a module that throws, times out or returns the wrong shape shows "section failed:
// <reason>" in its place, so one broken section never costs the rest of the report.
//
// The body is written for a GitHub issue on a public repository: `@` mentions and `#123`
// references outside code are defused with a zero-width space, and the body is capped at 60,000
// characters with a truncation note. Report only: it never moves, edits or places a file.
//
// Usage: node scripts/organisation/weekly-report.mjs [--out <file>] [--now <iso>] [--root <dir>]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { oneLine } from "./weekly-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "../..");
export const SECTIONS_DIR = path.join(HERE, "weekly");
// Per-area health first, then what is time-bound, then documents, map tidiness, proposals, and the
// two pure reports last.
export const SECTION_ORDER = [
  "issues-by-area",
  "review-dates",
  "stale-docs",
  "map-hygiene",
  "suggested-homes",
  "untested-code",
  "classifier-disagreements",
];
export const BODY_LIMIT = 60_000;
export const SECTION_TIMEOUT_MS = 5 * 60 * 1000;
const ZWSP = "​";

// ---------- escaping ----------

function escapeText(text) {
  return (
    text
      // @user, @org/team, and anything else GitHub could read as a mention.
      .replace(/@(?=[A-Za-z0-9])/g, `@${ZWSP}`)
      // #123 and owner/repo#123, but not an HTML entity such as &#123;.
      .replace(/(?<!&)#(?=\d)/g, `#${ZWSP}`)
      // GH-123 is GitHub's other issue shorthand.
      .replace(/\bGH-(?=\d)/gi, (match) => `${match.slice(0, 2)}${ZWSP}-`)
  );
}

// Leaves code spans alone (a mention inside backticks is already inert, and a zero-width space
// there would corrupt text someone may copy). A backtick run with no closing run is literal text.
function escapeInline(line) {
  let out = "";
  let index = 0;
  while (index < line.length) {
    const open = line.indexOf("`", index);
    if (open === -1) {
      out += escapeText(line.slice(index));
      break;
    }
    out += escapeText(line.slice(index, open));
    let openEnd = open;
    while (line[openEnd] === "`") openEnd += 1;
    const width = openEnd - open;
    let close = -1;
    let search = openEnd;
    while (search < line.length) {
      const next = line.indexOf("`", search);
      if (next === -1) break;
      let nextEnd = next;
      while (line[nextEnd] === "`") nextEnd += 1;
      if (nextEnd - next === width) {
        close = next;
        break;
      }
      search = nextEnd;
    }
    if (close === -1) {
      out += line.slice(open, openEnd);
      index = openEnd;
    } else {
      out += line.slice(open, close + width);
      index = close + width;
    }
  }
  return out;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

function closesFence(line, fence) {
  const match = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
  return Boolean(match && match[1][0] === fence[0] && match[1].length >= fence.length);
}

/** Defuses GitHub mentions and issue references outside code, line by line. */
export function escapeGithubReferences(markdown) {
  let fence = null;
  return markdown
    .split("\n")
    .map((line) => {
      if (fence) {
        if (closesFence(line, fence)) fence = null;
        return line;
      }
      const open = FENCE.exec(line);
      if (open) {
        fence = open[1];
        return line;
      }
      return escapeInline(line);
    })
    .join("\n");
}

function openFence(markdown) {
  let fence = null;
  for (const line of markdown.split("\n")) {
    if (fence) {
      if (closesFence(line, fence)) fence = null;
    } else {
      const open = FENCE.exec(line);
      if (open) fence = open[1];
    }
  }
  return fence;
}

/** Caps the body at `limit` characters, cutting at a line break and closing any open code fence. */
export function capBody(markdown, limit = BODY_LIMIT) {
  if (markdown.length <= limit) return markdown;
  const note = `\n\n_The report was cut here to stay under ${limit.toLocaleString("en-AU")} characters. Run \`node scripts/organisation/weekly-report.mjs\` locally for the whole report._\n`;
  const budget = limit - note.length - 16;
  let kept = markdown.slice(0, budget);
  const lastBreak = kept.lastIndexOf("\n");
  // Prefer a line break; cut mid-line only when one enormous line would otherwise lose most of it.
  if (lastBreak > budget / 2) kept = kept.slice(0, lastBreak);
  else if (/[\uD800-\uDBFF]$/.test(kept)) kept = kept.slice(0, -1);
  const fence = openFence(kept);
  if (fence) kept += `\n${fence}`;
  return `${kept}${note}`;
}

// ---------- sections ----------

const TIMED_OUT = Symbol("timed out");

function failureReason(error, root, timeoutMs) {
  if (error === TIMED_OUT) return `timed out after ${Math.ceil(timeoutMs / 1000)} s`;
  const raw = error instanceof Error ? error.message : String(error);
  // Never publish the machine's own paths; a repo-relative path says the same thing.
  return oneLine(raw.split(root).join("."), 300) || "unknown error";
}

/**
 * Loads and runs one section module.
 * @returns {Promise<{ name: string, status: "ok" | "failed" | "missing", title?: string, markdown?: string, reason?: string }>}
 */
export async function runSection(name, { root, now, sectionsDir = SECTIONS_DIR, timeoutMs = SECTION_TIMEOUT_MS }) {
  const file = path.join(sectionsDir, `${name}.mjs`);
  if (!fs.existsSync(file)) return { name, status: "missing" };
  let timer;
  try {
    const loaded = await import(pathToFileURL(file).href);
    if (typeof loaded.section !== "function") throw new Error("the module does not export a section() function");
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(TIMED_OUT), timeoutMs);
      timer.unref?.();
    });
    const result = await Promise.race([
      Promise.resolve().then(() => loaded.section({ root, now: new Date(now.getTime()) })),
      timeout,
    ]);
    if (!result || typeof result.title !== "string" || !result.title.trim() || typeof result.markdown !== "string") {
      throw new Error("the section returned no { title, markdown }");
    }
    return { name, status: "ok", title: oneLine(result.title, 120), markdown: result.markdown.trim() };
  } catch (error) {
    return { name, status: "failed", reason: failureReason(error, root, timeoutMs) };
  } finally {
    clearTimeout(timer);
  }
}

function headCommit(root) {
  const result = spawnSync("git", ["--no-optional-locks", "-C", root, "rev-parse", "HEAD"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

/**
 * Builds the whole report.
 * @returns {Promise<{ markdown: string, results: Awaited<ReturnType<typeof runSection>>[] }>}
 */
export async function buildWeeklyReport({
  root = REPO_ROOT,
  now = new Date(),
  sectionsDir = SECTIONS_DIR,
  order = SECTION_ORDER,
  timeoutMs = SECTION_TIMEOUT_MS,
  limit = BODY_LIMIT,
} = {}) {
  const results = [];
  for (const name of order) results.push(await runSection(name, { root, now, sectionsDir, timeoutMs }));
  const commit = headCommit(root);
  const lines = [
    "# Organisation weekly report",
    "",
    `Built ${now.toISOString()} from commit ${commit ? `\`${commit.slice(0, 12)}\`` : "(unknown)"}. It means "last checked at this commit", never "currently true". It is a report only: it never moves, edits or places a file, and it never blocks a pull request.`,
  ];
  for (const result of results) {
    if (result.status === "missing") continue;
    if (result.status === "failed") lines.push("", `## ${result.name}`, "", `section failed: ${result.reason}`);
    else lines.push("", `## ${result.title}`, "", result.markdown);
  }
  const missing = results.filter((result) => result.status === "missing").map((result) => result.name);
  lines.push("", "---", "");
  if (missing.length) lines.push(`Sections not present in this checkout: ${missing.join(", ")}.`, "");
  lines.push(
    "This report does not prove any code works, and an area placement is never a clinical, ranking, privacy, security or database approval.",
  );
  const markdown = capBody(`${escapeGithubReferences(lines.join("\n"))}\n`, limit);
  return { markdown, results };
}

// ---------- command line ----------

export function parseArgs(argv) {
  const args = { out: null, now: new Date(), root: REPO_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("--")) throw new Error(`${arg} needs a value`);
      index += 1;
      return next;
    };
    if (arg === "--out") args.out = path.resolve(value());
    else if (arg === "--root") args.root = path.resolve(value());
    else if (arg === "--now") {
      const text = value();
      const date = new Date(text);
      if (Number.isNaN(date.getTime())) throw new Error(`--now is not a date: ${text}`);
      args.now = date;
    } else throw new Error(`unknown argument ${arg}`);
  }
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`weekly-report: ${error.message}`);
    return 2;
  }
  const { markdown, results } = await buildWeeklyReport({ root: args.root, now: args.now });
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, markdown);
  } else process.stdout.write(markdown);
  const failed = results.filter((result) => result.status === "failed");
  const missing = results.filter((result) => result.status === "missing");
  for (const result of failed) {
    if (process.env.GITHUB_ACTIONS === "true") {
      console.log(`::warning title=Weekly report section failed::${result.name}: ${result.reason}`);
    }
  }
  console.error(
    `weekly-report: ${results.length - missing.length} section(s) run, ${failed.length} failed, ${missing.length} not present; ${markdown.length} characters${args.out ? ` written to ${path.relative(process.cwd(), args.out)}` : ""}`,
  );
  return 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`weekly-report: crashed: ${error?.stack ?? error}`);
      process.exitCode = 2;
    },
  );
}
