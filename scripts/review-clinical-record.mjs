#!/usr/bin/env node

/**
 * Local clinical sign-off for forms, Act-section summaries and statutory timeframes.
 *
 * This is how the clinical owner attests clinical content. No agent may ever record a
 * sign-off: `--write` refuses anything but a real interactive terminal, asks every
 * checklist question one at a time, and needs an exact typed confirmation. There is no
 * batch, yes, answers or provider mode, and one confirmation signs exactly one record.
 *
 * Report-only by default: it lists what is waiting and touches nothing.
 *
 * Usage:
 *   npm run clinical:review
 *   npm run clinical:review -- --kind form
 *   npm run clinical:review -- --kind form --code 3C
 *   npm run clinical:review -- --write --kind form --code 3C --reviewed-by "<public name>"
 *
 * Plain-English guide: docs/clinical-sign-off-how-to.md. The contract, including exactly
 * what the content pin covers, is scripts/lib/clinical-record-review-contract.mjs.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  applyClinicalReview,
  clinicalReviewConfirmation,
  collectionOf,
  finalizeClinicalReview,
  reviewerAttributionProblem,
  recordId,
  recordKinds,
  recordPinState,
  reviewProblems,
  sameRecordId,
  signOffEligibilityProblem,
  signOffQueue,
} from "./lib/clinical-record-review-contract.mjs";
import { createPrompt } from "./lib/confirm.mjs";

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KIND_NAMES = Object.keys(recordKinds);

function usage() {
  return [
    "Usage: npm run clinical:review -- [--kind form|section|timeframe] [--code <code>]",
    "       npm run clinical:review -- --write --kind <kind> --code <code> --reviewed-by <public name>",
    "       npm run clinical:review -- --write --walk --kind form|section --reviewed-by <public name>",
    "",
    "--walk steps through every unsigned record of one kind, one screen at a time (forms: 3C,",
    "10B, 10E, 11B, 11E, 6C, then catalogue order; sections: section-number order). Each record",
    "is saved the moment you confirm it, so quitting keeps everything signed so far.",
    "",
    "Without --write this only reports what is waiting and changes nothing.",
    "--write needs a real interactive terminal, one --kind, --reviewed-by, and --code or --walk.",
    "Every checklist answer is typed by you; there is no batch or automatic-yes mode.",
    "",
    '--code is the form code (3C, or "1A attachment" in quotes), the section number (26),',
    "or the timeframe id.",
    "",
    "reviewedBy is shown publicly in the app. Use your display name (for example",
    '"Dr Jane Citizen"); never an email address, AHPRA number, provider number or staff id.',
    "",
    "Guide: docs/clinical-sign-off-how-to.md",
  ].join("\n");
}

export function parseClinicalReviewArgs(argv) {
  const args = { help: false, write: false, walk: false, kind: undefined, code: undefined, reviewedBy: undefined };
  const seen = new Set();
  const valueFlags = { "--kind": "kind", "--code": "code", "--reviewed-by": "reviewedBy" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h" || token === "--write" || token === "--walk") {
      const name = token === "-h" ? "help" : token.slice(2);
      if (seen.has(name)) throw new Error(`${token} may only be supplied once.`);
      seen.add(name);
      args[name] = true;
      continue;
    }
    if (Object.hasOwn(valueFlags, token)) {
      const name = valueFlags[token];
      if (seen.has(name)) throw new Error(`${token} may only be supplied once.`);
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${token} requires a value.`);
      seen.add(name);
      args[name] = value;
      index += 1;
      continue;
    }
    throw new Error(
      `Unknown option: ${token}. Sign-off answers cannot be supplied through yes, answers, batch or provider flags.`,
    );
  }
  if (args.kind !== undefined && !KIND_NAMES.includes(args.kind)) {
    throw new Error(`--kind must be one of: ${KIND_NAMES.join(", ")}.`);
  }
  if (args.code !== undefined && args.kind === undefined) throw new Error("--code needs --kind as well.");
  if (args.walk && !args.write) throw new Error("--walk is a sign-off mode; use it with --write.");
  if (args.walk && args.code !== undefined) throw new Error("--walk goes through the whole queue; leave out --code.");
  return args;
}

function writeLine(output, value = "") {
  output.write(`${value}\n`);
}

function printable(value) {
  if (value === null || value === undefined || value === "") return "(not provided)";
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.length ? value.map((item) => `- ${item}`).join("\n") : "(none)";
  }
  return JSON.stringify(value, null, 2);
}

function catalogEntryFor(context, code) {
  return (context.catalog?.forms ?? []).find((entry) => sameRecordId(entry?.form, code)) ?? {};
}

function actTextFor(context, section) {
  return (context.actSource?.sections ?? []).find((entry) => entry.section === section);
}

function priorityFactsText(facts) {
  if (!facts || typeof facts !== "object") return facts;
  return Object.entries(facts)
    .map(([name, card]) =>
      card && typeof card === "object"
        ? [`${name}: ${card.title ?? ""}${card.detail ? ` (${card.detail})` : ""}`, card.body ? `  ${card.body}` : ""]
            .filter(Boolean)
            .join("\n")
        : `${name}: ${String(card)}`,
    )
    .join("\n");
}

/** What the owner reads before answering. Every field shown is inside the content pin. */
const DISPLAY = {
  form(record, context) {
    const entry = catalogEntryFor(context, record.code);
    return [
      ["Form", `${record.code} - ${entry.name ?? ""}`],
      ["Drafted from", record.basis],
      ["Operational sections", (record.sections ?? []).map((section) => `s ${section}`).join(", ")],
      ["Contextual sections", (record.contextualSections ?? []).map((section) => `s ${section}`).join(", ")],
      ["Purpose", entry.purpose],
      ["Made by", entry.maker],
      ["Also involved", entry.involved],
      ["When it applies", entry.threshold],
      ["Clock", entry.clock],
      ["Destination", entry.destination],
      ["Authorises", entry.authorises],
      ["Does not authorise", entry.doesNotAuthorise],
      ["Authority boundaries", entry.boundaries],
      [
        "Comes before / alongside / after",
        [entry.before, entry.parallel, entry.after].map((list) => (list ?? []).join(", ") || "-").join("  /  "),
      ],
      ["Filing and copies", entry.copies],
      ["Documentation stem", entry.documentationStem],
      ["Common traps", entry.traps],
      ["Safety pearl", entry.safetyPearl],
      ["Legal note", entry.legalNote],
      ["Practice pearls", entry.practicePearls],
      ["Pre-use checks", entry.preUseChecks],
      ["Priority facts", priorityFactsText(entry.priorityFacts)],
      ["Timings on the form", entry.sourceFacts?.timings],
      ["Section cue", entry.sourceFacts?.sectionCue],
    ];
  },
  section(record, context) {
    const act = actTextFor(context, record.section);
    return [
      ["Section", `s ${record.section} - ${record.title}`],
      ["Act text (verbatim)", act?.text ?? "(Act text not found in data/mha-2014-sections.source.json)"],
      ["Drafted summary", record.summary],
    ];
  },
  timeframe(record, context) {
    const act = actTextFor(context, record.section);
    return [
      ["Timeframe", record.id],
      ["Forms", (record.formCodes ?? []).join(", ")],
      ["Trigger", record.trigger],
      ["Quote", record.quote],
      ["Duration", record.duration ? `${record.duration.value} ${record.duration.unit}` : undefined],
      ["Clock starts", record.anchor],
      [`Act text, s ${record.section} (verbatim)`, act?.text ?? "(Act text not found)"],
    ];
  },
};

function showRecord(kind, record, context, output) {
  for (const [label, value] of DISPLAY[kind](record, context)) {
    writeLine(output, `\n[${label}]`);
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
 * Testable interactive core. `commit` is called exactly once, and only after every
 * checklist question is answered yes and the exact confirmation is typed.
 */
export async function conductClinicalReview({
  kind,
  record,
  context = {},
  reviewedBy,
  ask,
  commit,
  now = () => new Date(),
  output,
}) {
  const attributionProblem = reviewerAttributionProblem(reviewedBy);
  if (attributionProblem) throw new Error(attributionProblem);
  const eligibility = signOffEligibilityProblem(record, kind, context);
  if (eligibility) throw new Error(eligibility);

  showRecord(kind, record, context, output);
  writeLine(output);
  writeLine(output, "Answer yes only if you agree with the statement. Any no leaves this record unsigned.");
  const checklist = recordKinds[kind].checklist;
  for (const [position, check] of checklist.entries()) {
    writeLine(output);
    writeLine(output, `Question ${position + 1} of ${checklist.length}: ${check.question}`);
    let decision = null;
    while (decision === null) {
      decision = normalizeAnswer(await ask("Type yes, no, or quit: "));
      if (decision === null) writeLine(output, "Please type exactly yes, no, or quit.");
    }
    if (decision === "quit") {
      writeLine(output, "Stopped. Nothing was changed.");
      return { status: "quit", record };
    }
    if (decision === false) {
      writeLine(output, "Not signed off. Nothing was changed, and this record stays awaiting clinical review.");
      return { status: "incomplete", record };
    }
  }

  const expected = clinicalReviewConfirmation(kind, record);
  const confirmation = await ask(`\nTo sign this off, type its code (${expected}): `);
  if (!sameRecordId(confirmation, expected)) {
    writeLine(output, "That did not match. Nothing was changed.");
    return { status: "cancelled", record };
  }

  const reviewed = finalizeClinicalReview(record, kind, {
    reviewedBy,
    reviewedAt: now().toISOString(),
    context,
  });
  await commit(reviewed);
  return { status: "reviewed", record: reviewed };
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/** A kind's data file, or `{ status: "absent" }` for an optional kind whose file is not there yet. */
export function loadKindDocument(kind, { root = DEFAULT_ROOT } = {}) {
  const definition = recordKinds[kind];
  const path = join(root, definition.path);
  if (!existsSync(path)) {
    if (definition.optional) return { status: "absent", path };
    throw new Error(`${definition.path} is missing.`);
  }
  const raw = readFileSync(path, "utf8");
  return { status: "ok", path, raw, document: JSON.parse(raw) };
}

function loadContext(kind, root) {
  if (kind === "form") return { catalog: readJson(join(root, "data", "forms-catalog.json")) };
  const actPath = join(root, "data", "mha-2014-sections.source.json");
  return { actSource: existsSync(actPath) ? readJson(actPath) : undefined };
}

function showKindQueue(kind, root, output) {
  const definition = recordKinds[kind];
  const loaded = loadKindDocument(kind, { root });
  if (loaded.status === "absent") {
    writeLine(
      output,
      `${definition.heading}: ${definition.path} does not exist yet, so there is nothing to sign off here. Skipped.`,
    );
    return;
  }
  const records = collectionOf(kind, loaded.document);
  const context = loadContext(kind, root);
  const reviewed = records.filter((record) => record.status === "reviewed");
  const stale = reviewed.filter((record) => recordPinState(record, kind, context) !== "current");
  const waiting = signOffQueue(kind, records, context);
  const pending = records.filter((record) => record.status === "pending").length;
  writeLine(
    output,
    `${definition.heading} (${definition.path}): ${reviewed.length - stale.length} of ${records.length} signed off` +
      (pending ? `; ${pending} not yet written.` : "."),
  );
  if (stale.length) {
    writeLine(
      output,
      `  Edited since sign-off, needs signing again: ${stale.map((record) => recordId(record, kind)).join(", ")}`,
    );
  }
  if (waiting.length) {
    writeLine(output, `  Next: ${waiting[0]}`);
    writeLine(output, `  Waiting (${waiting.length}): ${waiting.join(", ")}`);
  } else {
    writeLine(output, "  Nothing waiting.");
  }
}

function showOneRecord(kind, code, root, output) {
  const loaded = loadKindDocument(kind, { root });
  if (loaded.status === "absent") {
    writeLine(output, `${recordKinds[kind].path} does not exist yet, so there is nothing to show. Skipped.`);
    return;
  }
  const record = collectionOf(kind, loaded.document).find((entry) => sameRecordId(recordId(entry, kind), code));
  if (!record) throw new Error(`No ${kind} with code ${code} in ${recordKinds[kind].path}.`);
  const context = loadContext(kind, root);
  showRecord(kind, record, context, output);
  const pin = recordPinState(record, kind, context);
  writeLine(output);
  writeLine(
    output,
    `Status: ${record.status}` +
      (record.reviewedBy ? `, signed off by ${record.reviewedBy} at ${record.reviewedAt}` : "") +
      (pin === "stale" ? " - EDITED SINCE SIGN-OFF, needs signing again" : ""),
  );
}

async function formatJson(document, path) {
  const text = `${JSON.stringify(document, null, 2)}\n`;
  try {
    const prettier = await import("prettier");
    const options = (await prettier.resolveConfig(path)) ?? {};
    return await prettier.format(text, { ...options, filepath: path });
  } catch {
    return text;
  }
}

function acquireLock(path) {
  const lockPath = `${path}.review.lock`;
  let descriptor;
  try {
    descriptor = openSync(lockPath, "wx");
    writeFileSync(descriptor, `${process.pid}\n`, "utf8");
    fsyncSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (error?.code === "EEXIST") {
      throw new Error(`Another sign-off is writing ${basename(path)}; refusing a concurrent write.`);
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
 * Same-directory temp file + fsync + rename, guarded by a lock and by the exact bytes
 * read when the review began, so a concurrent edit is never overwritten.
 */
export function writeDataFileAtomically(path, contents, expectedRaw) {
  const release = acquireLock(path);
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  let descriptor;
  try {
    if (readFileSync(path, "utf8") !== expectedRaw) {
      throw new Error(
        `${basename(path)} changed after the review began; refusing to overwrite it. Nothing was written.`,
      );
    }
    descriptor = openSync(temporary, "wx");
    writeFileSync(descriptor, contents);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    if (readFileSync(path, "utf8") !== expectedRaw) {
      throw new Error(`${basename(path)} changed while the sign-off was being written; nothing was written.`);
    }
    renameSync(temporary, path);
  } finally {
    try {
      if (descriptor !== undefined) closeSync(descriptor);
    } finally {
      if (existsSync(temporary)) rmSync(temporary, { force: true });
      release();
    }
  }
}

function regenerateFormsReviewSheet(root, errorOutput) {
  try {
    execFileSync(
      process.execPath,
      [join(root, "scripts", "run-tsx.mjs"), "scripts/build-forms-content-review-sheet.ts"],
      {
        cwd: root,
        stdio: "ignore",
      },
    );
  } catch {
    writeLine(errorOutput, "Note: the forms review sheet was not refreshed. Claude will refresh it when committing.");
  }
}

export async function main(argv = process.argv.slice(2), io = {}) {
  const input = io.input ?? process.stdin;
  const output = io.output ?? process.stdout;
  const errorOutput = io.errorOutput ?? process.stderr;
  const root = io.root ?? DEFAULT_ROOT;
  const args = parseClinicalReviewArgs(argv);
  if (args.help) {
    writeLine(output, usage());
    return 0;
  }

  if (!args.write) {
    if (args.reviewedBy !== undefined) {
      const problem = reviewerAttributionProblem(args.reviewedBy);
      if (problem) throw new Error(problem);
    }
    if (args.code !== undefined) {
      showOneRecord(args.kind, args.code, root, output);
    } else {
      writeLine(output, "Clinical sign-off queue.");
      writeLine(output);
      for (const kind of args.kind ? [args.kind] : KIND_NAMES) showKindQueue(kind, root, output);
      writeLine(output);
      writeLine(
        output,
        'To sign one off: npm run clinical:review -- --write --kind form --code 3C --reviewed-by "<your public name>"',
      );
    }
    writeLine(output, "Report only; no file was changed.");
    return 0;
  }

  if (!input.isTTY || !output.isTTY) {
    throw new Error("--write requires an interactive TTY; piped, scripted and agent-supplied sign-offs are refused.");
  }
  if (!args.kind) throw new Error("--write needs one --kind.");
  if (!args.walk && !args.code) {
    throw new Error("--write needs --code for one record, or --walk to step through the queue one record at a time.");
  }
  if (!args.reviewedBy) throw new Error("--write needs --reviewed-by with your public display name.");
  const attributionProblem = reviewerAttributionProblem(args.reviewedBy);
  if (attributionProblem) throw new Error(attributionProblem);

  const kind = args.kind;
  const first = loadKindDocument(kind, { root });
  if (first.status === "absent") {
    throw new Error(`${recordKinds[kind].path} does not exist yet; there is nothing to sign off for ${kind}.`);
  }
  const codes = args.walk
    ? signOffQueue(kind, collectionOf(kind, first.document), loadContext(kind, root))
    : [args.code];
  if (args.walk && codes.length === 0) {
    writeLine(output, `Nothing waiting: every ${kind} is already signed off.`);
    return 0;
  }
  if (!args.walk) {
    // Fail before any prompt for an unknown or ineligible single record.
    const record = collectionOf(kind, first.document).find((entry) => sameRecordId(recordId(entry, kind), args.code));
    if (!record) throw new Error(`No ${kind} with code ${args.code} in ${recordKinds[kind].path}.`);
    const eligibility = signOffEligibilityProblem(record, kind, loadContext(kind, root));
    if (eligibility) throw new Error(eligibility);
  }

  writeLine(errorOutput, "CLINICAL AUTHORITY: only the clinical owner may sign this off, after reading it in full.");
  writeLine(
    errorOutput,
    "PRIVACY: your reviewer name is shown publicly. Do not enter an email or registration number.",
  );
  const signed = [];
  const skipped = [];
  const prompt = createPrompt({ input, output });
  try {
    for (const [position, code] of codes.entries()) {
      // Re-read before every record, so each save is checked against the file as it is now.
      const loaded = loadKindDocument(kind, { root });
      const context = loadContext(kind, root);
      const record = collectionOf(kind, loaded.document).find((entry) => sameRecordId(recordId(entry, kind), code));
      if (!record || signOffEligibilityProblem(record, kind, context)) {
        skipped.push(code);
        continue;
      }
      writeLine(output);
      writeLine(output, "=".repeat(60));
      writeLine(
        output,
        args.walk
          ? `${recordKinds[kind].noun} ${code}  (${position + 1} of ${codes.length})`
          : `${recordKinds[kind].noun} ${code}`,
      );
      if (record.status === "reviewed") {
        writeLine(output, `Signed off before (${record.reviewedAt}), but the text has been edited since.`);
      }
      writeLine(output, "=".repeat(60));
      const result = await conductClinicalReview({
        kind,
        record,
        context,
        reviewedBy: args.reviewedBy,
        ask: prompt.ask,
        output,
        commit: async (reviewed) => {
          const nextDocument = applyClinicalReview(loaded.document, kind, reviewed);
          const problems = reviewProblems([reviewed], kind, context);
          if (problems.length) throw new Error(`Refusing to write an invalid sign-off:\n- ${problems.join("\n- ")}`);
          writeDataFileAtomically(loaded.path, await formatJson(nextDocument, loaded.path), loaded.raw);
        },
      });
      if (result.status === "reviewed") {
        signed.push(code);
        writeLine(output, `Saved: ${recordKinds[kind].noun} ${code} is signed off.`);
      } else if (result.status === "quit") {
        break;
      } else {
        skipped.push(code);
      }
    }
  } finally {
    prompt.close();
    if (kind === "form" && signed.length) regenerateFormsReviewSheet(root, errorOutput);
    writeLine(output);
    writeLine(output, `Signed off this session: ${signed.length ? signed.join(", ") : "none"}.`);
    if (skipped.length) writeLine(output, `Left unsigned: ${skipped.join(", ")}.`);
    if (signed.length) {
      writeLine(output, "Your sign-offs are saved on this computer. See the guide for how to send them.");
    }
  }
  return 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      if (error?.code === "ABORT_ERR") {
        console.error("Stopped. Every record you confirmed before this point is saved.");
        process.exitCode = 130;
        return;
      }
      console.error(`clinical:review: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    },
  );
}
