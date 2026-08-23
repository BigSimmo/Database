#!/usr/bin/env node

/**
 * Local, clinician-input Therapy sign-off workflow.
 *
 * Report-only by default. `--write` requires an interactive TTY, seven explicit
 * answers, and an exact final confirmation. It has no batch, yes, provider, or
 * production mode.
 *
 * Usage:
 *   npm run therapy:review
 *   npm run therapy:review -- --slug <slug>
 *   npm run therapy:review -- --write --slug <slug> --reviewed-by "<public attribution>"
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  THERAPY_GENERATED_PATHS,
  THERAPY_HASHED_ASSET_RE,
  THERAPY_REVIEW_CHECKS,
  assertValidTherapyReviewRecords,
  finalizeTherapyReview,
  publicReviewerAttributionProblem,
} from "./lib/therapy-review-contract.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = join(ROOT, THERAPY_GENERATED_PATHS.source);
const PUBLIC_DATA_PATH = join(ROOT, THERAPY_GENERATED_PATHS.publicDirectory);
const FIXED_GENERATED_PATHS = Object.freeze([
  join(ROOT, THERAPY_GENERATED_PATHS.serverIndex),
  join(ROOT, THERAPY_GENERATED_PATHS.manifest),
  join(PUBLIC_DATA_PATH, THERAPY_GENERATED_PATHS.retiredHomeAlias),
]);
const GENERATOR_PATH = join(ROOT, "scripts", "build-therapies-index.mjs");

function usage() {
  return [
    "Usage: npm run therapy:review -- [--slug <slug>] [--write --reviewed-by <public attribution>]",
    "",
    "Without --write this is a report-only queue/record inspection and touches nothing.",
    "--write requires a real interactive TTY and one exact --slug.",
    "Every checklist answer is entered interactively; no batch or automatic-yes mode exists.",
    "",
    "reviewedBy is shipped in the public Therapy catalogue. Use only a display-approved",
    "professional name or governance-owner label; never enter an email address, account id,",
    "AHPRA/registration number, provider number, employee/staff id, or another private identifier.",
  ].join("\n");
}

export function parseTherapyReviewArgs(argv) {
  const args = { help: false, write: false, slug: undefined, reviewedBy: undefined };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      if (seen.has("help")) throw new Error("--help may only be supplied once.");
      seen.add("help");
      args.help = true;
      continue;
    }
    if (token === "--write") {
      if (seen.has("write")) throw new Error("--write may only be supplied once.");
      seen.add("write");
      args.write = true;
      continue;
    }
    if (token === "--slug" || token === "--reviewed-by") {
      const name = token.slice(2);
      if (seen.has(name)) throw new Error(`${token} may only be supplied once.`);
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${token} requires a value.`);
      seen.add(name);
      if (token === "--slug") args.slug = value;
      else args.reviewedBy = value;
      index += 1;
      continue;
    }
    throw new Error(
      `Unknown option: ${token}. Therapy attestations cannot be supplied through yes, answer, batch, or provider flags.`,
    );
  }
  return args;
}

function writeLine(output, value = "") {
  output.write(`${value}\n`);
}

function printable(value) {
  if (value === null || value === undefined || value === "") return "(not provided)";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function renderedProseEntries(record) {
  return Object.entries(record).filter(
    ([key, value]) =>
      !["reviewStatus", "reviewChecklist", "reviewedBy", "reviewedAt", "reviewedContentSha256"].includes(key) &&
      (typeof value === "string" || Array.isArray(value)),
  );
}

function showCheck(record, check, output) {
  writeLine(output);
  writeLine(output, `=== ${check.label} (${check.authority}) ===`);
  const entries = check.fields.flatMap((field) =>
    field === "all rendered prose" ? renderedProseEntries(record) : [[field, record[field]]],
  );
  for (const [field, value] of entries) {
    writeLine(output, `\n[${field}]`);
    writeLine(output, printable(value));
  }
}

function normalizeAnswer(value) {
  const answer = String(value).trim().toLowerCase();
  if (answer === "yes") return true;
  if (answer === "no") return false;
  if (answer === "quit" || answer === "q") return "quit";
  return null;
}

/**
 * Testable interactive core. `commit` is called exactly once only after seven
 * explicit yes answers and the exact final confirmation.
 */
export async function conductTherapyReview({ record, reviewedBy, ask, commit, now = () => new Date(), output }) {
  const attributionProblem = publicReviewerAttributionProblem(reviewedBy);
  if (attributionProblem) throw new Error(attributionProblem);

  const answers = {};
  for (const check of THERAPY_REVIEW_CHECKS) {
    showCheck(record, check, output);
    let decision = null;
    while (decision === null) {
      decision = normalizeAnswer(
        await ask(`\nEnter yes only if you personally attest "${check.label}"; otherwise enter no or quit: `),
      );
      if (decision === null) writeLine(output, "Enter exactly yes, no, or quit.");
    }
    if (decision === "quit") return { status: "quit", record };
    answers[check.key] = decision;
  }

  if (Object.values(answers).some((answer) => answer !== true)) {
    writeLine(output, "At least one check was not attested. The source remains unchanged and needs_review.");
    return { status: "incomplete", record };
  }

  const expectedConfirmation = `REVIEW ${record.slug}`;
  const confirmation = await ask(`\nType ${expectedConfirmation} to write this clinician sign-off: `);
  if (confirmation !== expectedConfirmation) {
    writeLine(output, "Confirmation did not match. The source remains unchanged.");
    return { status: "cancelled", record };
  }

  const reviewedAt = now().toISOString();
  const reviewed = finalizeTherapyReview(record, { answers, reviewedBy, reviewedAt, now: new Date(reviewedAt) });
  await commit(reviewed);
  return { status: "reviewed", record: reviewed };
}

function replaceFileAtomically(path, contents, { expectedRaw } = {}) {
  if (expectedRaw !== undefined && readFileSync(path, "utf8") !== expectedRaw) {
    throw new Error("Therapy source changed after review began; refusing to overwrite concurrent work.");
  }
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  let descriptor;
  try {
    descriptor = openSync(temporary, "wx");
    writeFileSync(descriptor, contents);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    if (expectedRaw !== undefined && readFileSync(path, "utf8") !== expectedRaw) {
      throw new Error(
        "Therapy source changed while sign-off was being written; refusing to overwrite concurrent work.",
      );
    }
    renameSync(temporary, path);
  } finally {
    try {
      if (descriptor !== undefined) closeSync(descriptor);
    } finally {
      if (existsSync(temporary)) rmSync(temporary, { force: true });
    }
  }
}

/** Compact, same-directory atomic replacement for the canonical one-line JSON. */
export function writeTherapySourceAtomically(path, records, { expectedRaw } = {}) {
  replaceFileAtomically(path, JSON.stringify(records), { expectedRaw });
}

function listGeneratedCataloguePaths() {
  if (!existsSync(PUBLIC_DATA_PATH)) return [];
  return readdirSync(PUBLIC_DATA_PATH)
    .filter((name) => THERAPY_HASHED_ASSET_RE.test(name))
    .map((name) => join(PUBLIC_DATA_PATH, name));
}

function captureGeneratedFiles(fixedGeneratedPaths, listGeneratedPaths) {
  const paths = new Set([...fixedGeneratedPaths, ...listGeneratedPaths()]);
  return new Map([...paths].map((path) => [path, existsSync(path) ? readFileSync(path) : null]));
}

function restoreGeneratedFiles(snapshot, fixedGeneratedPaths, listGeneratedPaths) {
  const currentPaths = new Set([...fixedGeneratedPaths, ...listGeneratedPaths()]);
  for (const path of currentPaths) {
    if (!snapshot.has(path) && existsSync(path)) rmSync(path, { force: true });
  }
  for (const [path, contents] of snapshot) {
    if (contents === null) {
      if (existsSync(path)) rmSync(path, { force: true });
    } else {
      replaceFileAtomically(path, contents);
    }
  }
}

function acquireReviewTransactionLock(sourcePath) {
  const lockPath = `${sourcePath}.review.lock`;
  let descriptor;
  let created = false;
  try {
    descriptor = openSync(lockPath, "wx");
    created = true;
    writeFileSync(descriptor, `${process.pid}\n`, "utf8");
    fsyncSync(descriptor);
  } catch (error) {
    try {
      if (descriptor !== undefined) closeSync(descriptor);
    } finally {
      if (created && existsSync(lockPath)) rmSync(lockPath, { force: true });
    }
    if (error?.code === "EEXIST") {
      throw new Error("Another Therapy review transaction is active; refusing a concurrent write.");
    }
    throw error;
  }
  return () => {
    try {
      closeSync(descriptor);
    } finally {
      rmSync(lockPath, { force: true });
    }
  };
}

/**
 * Commit source plus every generator-owned asset as one recoverable unit. Any
 * generator/check failure restores the exact pre-review bytes and removes new
 * content-addressed artifacts before the error reaches the CLI.
 */
export function persistTherapyReviewTransaction({
  sourcePath = SOURCE_PATH,
  records,
  expectedRaw,
  fixedGeneratedPaths = FIXED_GENERATED_PATHS,
  listGeneratedPaths = listGeneratedCataloguePaths,
  runGenerator = regenerateAndValidate,
}) {
  const releaseLock = acquireReviewTransactionLock(sourcePath);
  try {
    if (typeof expectedRaw !== "string" || readFileSync(sourcePath, "utf8") !== expectedRaw) {
      throw new Error("Therapy source changed after review began; refusing to overwrite concurrent work.");
    }
    const sourceBefore = Buffer.from(expectedRaw);
    const generatedBefore = captureGeneratedFiles(fixedGeneratedPaths, listGeneratedPaths);
    let sourceCommitted = false;
    try {
      writeTherapySourceAtomically(sourcePath, records, { expectedRaw });
      sourceCommitted = true;
      runGenerator();
    } catch (error) {
      if (!sourceCommitted) throw error;
      try {
        restoreGeneratedFiles(generatedBefore, fixedGeneratedPaths, listGeneratedPaths);
        replaceFileAtomically(sourcePath, sourceBefore);
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          "Therapy sign-off failed and rollback could not restore every pre-review byte.",
        );
      }
      throw new Error("Therapy sign-off failed; exact pre-review source and generated asset bytes were restored.", {
        cause: error,
      });
    }
  } finally {
    releaseLock();
  }
}

function regenerateAndValidate() {
  execFileSync(process.execPath, [GENERATOR_PATH], { cwd: ROOT, stdio: "inherit" });
  execFileSync(process.execPath, [GENERATOR_PATH, "--check"], { cwd: ROOT, stdio: "inherit" });
}

function readCanonicalSource() {
  const raw = readFileSync(SOURCE_PATH, "utf8");
  return { raw, records: JSON.parse(raw) };
}

function showReport(records, slug, output) {
  const pending = records.filter((record) => record.reviewStatus !== "reviewed");
  writeLine(output, `Therapy review queue: ${pending.length} needs_review / ${records.length} total.`);
  if (!slug) {
    const first = pending[0];
    if (first) writeLine(output, `Next record: ${first.slug} — ${first.name}`);
    writeLine(
      output,
      "Report only. Pass --slug <slug> to inspect one record; add --write only during clinician sign-off.",
    );
    return;
  }
  const record = records.find((entry) => entry.slug === slug);
  if (!record) throw new Error(`Unknown Therapy slug: ${slug}`);
  writeLine(output, `${record.slug} — ${record.name}`);
  writeLine(output, `Status: ${record.reviewStatus}`);
  for (const check of THERAPY_REVIEW_CHECKS) {
    writeLine(output, `- ${check.key}: ${String(record.reviewChecklist?.[check.key])} (${check.authority})`);
  }
  writeLine(output, "Report only; no file was changed.");
}

export async function main(argv = process.argv.slice(2), io = {}) {
  const input = io.input ?? process.stdin;
  const output = io.output ?? process.stdout;
  const errorOutput = io.errorOutput ?? process.stderr;
  const args = parseTherapyReviewArgs(argv);
  if (args.help) {
    writeLine(output, usage());
    return 0;
  }

  const { raw, records } = readCanonicalSource();
  assertValidTherapyReviewRecords(records);
  if (args.reviewedBy !== undefined) {
    const attributionProblem = publicReviewerAttributionProblem(args.reviewedBy);
    if (attributionProblem) throw new Error(attributionProblem);
  }
  if (!args.write) {
    showReport(records, args.slug, output);
    return 0;
  }

  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      "--write requires an interactive TTY; piped, scripted, and agent-supplied attestations are refused.",
    );
  }
  if (!args.slug) throw new Error("--write requires one exact --slug; batch sign-off is not supported.");
  if (!args.reviewedBy) throw new Error("--write requires --reviewed-by with a display-approved public attribution.");
  const recordIndex = records.findIndex((record) => record.slug === args.slug);
  if (recordIndex === -1) throw new Error(`Unknown Therapy slug: ${args.slug}`);
  if (records[recordIndex].reviewStatus === "reviewed") {
    throw new Error(`${args.slug} is already reviewed; this tool will not overwrite an existing attestation.`);
  }

  writeLine(errorOutput, "CLINICAL AUTHORITY: the first five checks may only be attested by a qualified clinician.");
  writeLine(
    errorOutput,
    "PRIVACY: reviewedBy is public. Do not enter contact, registration, provider, staff, or account ids.",
  );
  const readline = createInterface({ input, output });
  try {
    const result = await conductTherapyReview({
      record: records[recordIndex],
      reviewedBy: args.reviewedBy,
      ask: (question) => readline.question(question),
      output,
      commit: async (reviewed) => {
        const nextRecords = records.map((record, index) => (index === recordIndex ? reviewed : record));
        assertValidTherapyReviewRecords(nextRecords);
        persistTherapyReviewTransaction({ sourcePath: SOURCE_PATH, records: nextRecords, expectedRaw: raw });
      },
    });
    if (result.status === "reviewed") {
      writeLine(output, `Recorded local clinician sign-off for ${args.slug}; generated Therapy assets are current.`);
    }
    return 0;
  } finally {
    readline.close();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(`therapy:review: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
