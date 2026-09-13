#!/usr/bin/env node
/**
 * Build `data/hazard-register-snapshot.json` — the input to the developer hub's
 * hazard register panel.
 *
 * This repository holds THREE hazard records with three different authorities,
 * and the whole point of this generator is that they arrive at the page still
 * separated. Merging them into one list would manufacture a coverage claim
 * nobody has made:
 *
 *   1. `docs/clinical-hazard-controls.json` — the PsychSift answer pipeline
 *      (H1-H6). Machine-checked by `check:clinical-hazard-controls`, and its
 *      own `authority` field says it establishes static evidence only.
 *   2. `docs/caring-contacts/hazard-log.md` — Caring Contacts. A DRAFT that no
 *      clinician has signed. Parsed from its markdown tables.
 *   3. Ward Flow — no register exists. Recorded as an absence, with the ledger
 *      rows that mention it offered as "the only writing there is", explicitly
 *      not as a register and explicitly not complete.
 *
 * Run: npm run snapshot:hazards
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export const HAZARD_SNAPSHOT_VERSION = "hazard-register-snapshot-v1";
export const REVIEW_TIME_ZONE = "Australia/Perth";

const CONTROLS_JSON = "docs/clinical-hazard-controls.json";
const ANALYSIS_MD = "docs/clinical-hazard-analysis.md";
const CARING_CONTACTS_MD = "docs/caring-contacts/hazard-log.md";
const LEDGER_SNAPSHOT = "data/outstanding-issues-snapshot.json";

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

/** Strip the markdown emphasis and links a table cell carries, leaving readable text. */
export function plainCell(cell) {
  return cell
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split one markdown table row into cells.
 *
 * Splitting on a bare `|` would cut a cell containing an escaped pipe or a pipe
 * inside code, so the leading and trailing delimiters are removed first and the
 * split is done on the remainder — the shape every table in these documents uses.
 */
export function tableCells(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cell = "";
  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (character === "\\" && trimmed[index + 1] === "|") {
      cell += "|";
      index += 1;
    } else if (character === "|") {
      cells.push(plainCell(cell));
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(plainCell(cell));
  return cells;
}

/** Every `H-…` row in a markdown table, from anywhere in the document. */
export function parseHazardRows(markdown) {
  const rows = [];
  for (const line of markdown.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = tableCells(line);
    // Header and alignment rows have no hazard id in column one.
    if (!/^H-[A-Z0-9]+$/i.test(cells[0])) continue;
    if (cells.length !== 8) {
      throw new Error(`Hazard row ${cells[0]} expected 8 cells, received ${cells.length}`);
    }
    const [id, hazard, cause, harm, control, residualRisk, owner, status] = cells;
    rows.push({ id, hazard, cause, harm, control, residualRisk, owner, status });
  }
  return rows;
}

/**
 * Normalise a Caring Contacts status cell to the three states its own "How to
 * read the columns" section defines. An unrecognised value is passed through
 * rather than coerced: a status this parser has not seen is a change to the
 * document, and the page must show it rather than silently file it as controlled.
 */
export function normaliseStatus(status) {
  const value = status.toLowerCase();
  if (value.includes("unmitigated")) return "unmitigated";
  if (value.startsWith("partial")) return "partial";
  // Any Controlled* status (including governance-gated / blueprint / fallback wording)
  // is a code-level control that has not received clinical sign-off of the register itself.
  if (value.includes("unreviewed") || value.startsWith("controlled")) return "controlled-unreviewed";
  return status;
}

/** The `### H1 — …` headings in the analysis document, which the JSON register has no titles for. */
export function parseAnalysisTitles(markdown) {
  // Annotated because this file is plain JavaScript: without it TypeScript
  // infers the empty literal's type, `{}`, and every consumer sees a map with
  // no keys.
  /** @type {Record<string, string>} */
  const titles = {};
  for (const line of markdown.split("\n")) {
    const match = /^#{2,4}\s+(H[0-9]+)\s+[—-]\s+(.*)$/.exec(line.trim());
    // First heading wins: H5 carries a second, narrower heading for one
    // sub-topic, and the broad one is the hazard's own title.
    if (match && !titles[match[1]]) titles[match[1]] = plainCell(match[2]);
  }
  return titles;
}

/** Whether a review date has passed, given "today". Undated reviews are never "current". */
function reviewDateIsValid(reviewExpiresAt) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewExpiresAt ?? "")) return false;
  const parsed = new Date(`${reviewExpiresAt}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === reviewExpiresAt;
}

function perthTodayIso(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REVIEW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function reviewExpired(reviewExpiresAt, now) {
  return !reviewDateIsValid(reviewExpiresAt) || reviewExpiresAt < perthTodayIso(now);
}

function buildPsychSiftRegister(now) {
  const controls = JSON.parse(read(CONTROLS_JSON));
  const titles = parseAnalysisTitles(read(ANALYSIS_MD));

  return {
    id: "psychsift-answer-pipeline",
    name: "PsychSift answer pipeline",
    scope: "Retrieval, answer generation, citations and copy/export.",
    sourcePath: CONTROLS_JSON,
    exists: true,
    // Its own words, not a summary of them: this is the sentence that stops the
    // panel being read as clinical assurance.
    authority: controls.authority,
    signedOff: false,
    gate: "check:clinical-hazard-controls",
    reviewedAt: controls.reviewedAt ?? null,
    reviewExpiresAt: controls.reviewExpiresAt ?? null,
    reviewExpired: reviewExpired(controls.reviewExpiresAt, now),
    hazards: controls.hazards.map((hazard) => ({
      id: hazard.id,
      title: titles[hazard.id] ?? null,
      status: hazard.state,
      owner: hazard.owner ?? null,
      residualRisk: hazard.residualRisk ?? null,
      controlCount: (hazard.controlPaths ?? []).length,
      testCount: (hazard.tests ?? []).length,
      reviewExpiresAt: hazard.reviewExpiresAt ?? null,
      reviewExpired: reviewExpired(hazard.reviewExpiresAt, now),
    })),
    openAssuranceDecisions: (controls.assuranceDecisions ?? [])
      .filter((decision) => decision.state !== "closed")
      .map((decision) => ({
        id: decision.id,
        owner: decision.owner ?? null,
        residualRisk: decision.residualRisk ?? null,
      })),
  };
}

/** The complete opening authority block, with Markdown presentation removed but no wording omitted. */
export function caringContactsAuthority(markdown) {
  const match = /^# Caring Contacts — hazard log\s*\n\n((?:>.*(?:\n|$))+)/m.exec(markdown);
  if (!match) throw new Error("Caring Contacts hazard log has no opening authority block");
  return plainCell(
    match[1]
      .split("\n")
      .map((line) => line.replace(/^>\s?/, ""))
      .join(" "),
  );
}

// Takes no `now`: a draft nobody has signed has no review to expire, so there is
// no date here to compare against one.
function buildCaringContactsRegister() {
  const markdown = read(CARING_CONTACTS_MD);
  const rows = parseHazardRows(markdown);
  const statusLine = /\*\*Status:\*\*\s*(.+)/.exec(markdown);

  return {
    id: "caring-contacts",
    name: "Caring Contacts",
    scope: "The Caring Contacts workspace only. It does not cover the answer pipeline.",
    sourcePath: CARING_CONTACTS_MD,
    exists: true,
    authority: caringContactsAuthority(markdown),
    signedOff: false,
    gate: null,
    reviewedAt: null,
    // A draft nobody has signed has no review to expire; `signedOff: false` is
    // the fact that matters, and inventing an expiry would imply a review happened.
    reviewExpiresAt: null,
    reviewExpired: false,
    documentStatus: statusLine ? plainCell(statusLine[1]) : null,
    hazards: rows.map((row) => ({
      id: row.id,
      title: row.hazard,
      status: normaliseStatus(row.status),
      owner: row.owner,
      residualRisk: row.residualRisk,
      harm: row.harm,
      hasControl: !/^none$/i.test(row.control.trim()),
      reviewExpiresAt: null,
      reviewExpired: false,
    })),
    openAssuranceDecisions: [],
  };
}

/**
 * Ward Flow has no hazard register. That absence is the finding, so it is
 * recorded as one rather than left as an empty section a reader would take for
 * "no hazards".
 *
 * The ledger rows below are offered as the only writing that exists, and are
 * labelled in the type as `ledgerMentions` — never `hazards` — because a text
 * match on a summary is not a register and cannot be complete.
 *
 * Restricted to P1 and matched on the summary alone. Both narrowings are
 * deliberate. Searching the detail text too, at every priority, returned rows
 * about a flaky demo-clock test and a missing print stylesheet: real work, but
 * listing them under a hazard heading trains the reader to skim the section,
 * which is the one thing a hazard surface must never do. P1 in this ledger is
 * "do next / blocking", which is the closest thing it has to a safety marker —
 * an approximation, and the page says so rather than implying the filter is a
 * classification.
 */
function buildWardFlowRegister() {
  const ledger = JSON.parse(read(LEDGER_SNAPSHOT));
  const mentions = (ledger.open ?? [])
    .filter((item) => item.priority === "P1" && /ward flow/i.test(item.summary))
    .map((item) => ({ id: item.id, priority: item.priority, summary: item.summary }));

  return {
    id: "ward-flow",
    name: "Ward Flow",
    scope: "Bed matching, placement, transport and movements.",
    sourcePath: null,
    exists: false,
    authority: "No hazard register has been written. Nothing here has been reviewed against one.",
    signedOff: false,
    gate: null,
    reviewedAt: null,
    reviewExpiresAt: null,
    reviewExpired: false,
    hazards: [],
    ledgerMentions: mentions,
    openAssuranceDecisions: [],
  };
}

export function buildHazardSnapshot(now = new Date()) {
  const registers = [buildPsychSiftRegister(now), buildCaringContactsRegister(), buildWardFlowRegister()];

  const allHazards = registers.flatMap((register) => register.hazards);
  return {
    version: HAZARD_SNAPSHOT_VERSION,
    generatedAt: now.toISOString().slice(0, 10),
    counts: {
      registers: registers.length,
      registersMissing: registers.filter((register) => !register.exists).length,
      registersUnsigned: registers.filter((register) => register.exists && !register.signedOff).length,
      hazards: allHazards.length,
      unmitigated: allHazards.filter((hazard) => hazard.status === "unmitigated").length,
      reviewExpired: allHazards.filter((hazard) => hazard.reviewExpired).length,
    },
    registers,
  };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const snapshot = buildHazardSnapshot();
  const target = join(repoRoot, "data/hazard-register-snapshot.json");
  writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(
    `[hazard-register] wrote data/hazard-register-snapshot.json ` +
      `(${snapshot.counts.hazards} hazards across ${snapshot.counts.registers} registers, ` +
      `${snapshot.counts.unmitigated} unmitigated, ${snapshot.counts.registersMissing} register(s) missing)`,
  );
}
