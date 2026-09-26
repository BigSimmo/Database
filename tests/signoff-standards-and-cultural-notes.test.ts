import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  applyClinicalReview,
  collectionOf,
  finalizeClinicalReview,
  indigenousContentIn,
  recordPinState,
  reviewProblems,
  signOffQueue,
} from "../scripts/lib/clinical-record-review-contract.mjs";
import { indigenousContentTerm } from "../scripts/lib/indigenous-content.mjs";
import {
  CULTURAL_NOTE_LABELS as PINNED_CULTURAL_NOTE_LABELS,
  display,
  loadContext,
} from "../scripts/lib/signoff-kinds/standards-and-cultural-notes.mjs";
import { main } from "../scripts/review-clinical-record.mjs";

import { parseChiefPsychiatristStandards } from "@/components/forms/act-and-standards-content";
import { CULTURAL_NOTE_LABELS, culturalNoteReviewer, type FormCulturalNote } from "@/lib/forms-cultural-notes";
import { isIndigenousContent } from "@/lib/forms-reference-sign-off";

/**
 * The `standard` and `cultural-note` sign-off kinds (ledger #XD5BHM): the Chief
 * Psychiatrist's Standards summaries on /forms/act and the interpreter, Aboriginal-liaison
 * and Act notes on a form's page. Every record on disk must be unsigned or carry a current
 * pin; a sign-off must touch only its own record's review fields; an edit to anything the
 * page shows must unsign it; and the site must show a sign-off only when it is complete,
 * and never for Indigenous content (owner rule 2026-09-26).
 */

type Json = Record<string, unknown>;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = new Date("2026-09-26T06:00:00.000Z");
const REVIEWED_AT = "2026-09-25T05:00:00.000Z";
const REVIEWER = "Dr Clinical Owner";

const readDocument = (path: string): Json => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const clone = <T>(value: T): T => structuredClone(value);

const KINDS = [
  { kind: "standard", path: "data/chief-psychiatrist-standards.json", key: "standards", total: 8, indigenous: 1 },
  { kind: "cultural-note", path: "data/forms-cultural-notes.json", key: "notes", total: 23, indigenous: 9 },
] as const;

let context: Json;
beforeAll(async () => {
  context = (await loadContext("standard", ROOT)) as Json;
});

/** The first drafted record the owner may sign (Indigenous content is held), as the tool views it. */
function firstSignable(kind: string, document: Json): Json {
  const record = collectionOf(kind, document).find(
    (entry: Json) => entry.status === "drafted" && !indigenousContentIn(entry, kind, context),
  );
  expect(record, `${kind} has a drafted, non-Indigenous record`).toBeTruthy();
  return record;
}

function sign(kind: string, document: Json, record: Json) {
  const signed = finalizeClinicalReview(record, kind, {
    reviewedBy: REVIEWER,
    reviewedAt: REVIEWED_AT,
    context,
    now: NOW,
  });
  return { signed, after: applyClinicalReview(clone(document), kind, signed) as Json };
}

describe.each(KINDS)("$kind sign-off kind ($path)", ({ kind, path, key, total, indigenous }) => {
  const document = readDocument(path);
  const records = () => collectionOf(kind, document) as Json[];

  it("every record on disk is unsigned or carries a current pin", () => {
    expect(reviewProblems(records(), kind, { ...context, now: NOW })).toEqual([]);
    for (const record of records()) {
      expect(["unsigned", "current"], String(record.id)).toContain(recordPinState(record, kind, context));
    }
  });

  it(`holds ${total} records: every one not signed off is waiting, or held as Indigenous content`, () => {
    const all = records();
    expect(all).toHaveLength(total);
    const held = all.filter((record) => indigenousContentIn(record, kind, context));
    expect(held).toHaveLength(indigenous);
    const signed = all.filter((record) => recordPinState(record, kind, context) === "current");
    const waiting = signOffQueue(kind, all, context);
    expect(waiting.length + held.length + signed.length).toBe(total);
    // Before anything is signed: 8 standards and 23 notes wait for review, of which 1 and 9 are held.
    if (!signed.length) expect(all.every((record) => record.status === "drafted")).toBe(true);
  });

  it("refuses to sign Indigenous content", () => {
    const record = records().find((entry) => entry.status === "drafted" && indigenousContentIn(entry, kind, context));
    expect(record).toBeTruthy();
    expect(() =>
      finalizeClinicalReview(record, kind, { reviewedBy: REVIEWER, reviewedAt: REVIEWED_AT, context, now: NOW }),
    ).toThrow(/Indigenous/);
  });

  it("a round trip writes only the target record's review fields", () => {
    const record = firstSignable(kind, document);
    const { signed, after } = sign(kind, document, record);
    expect(signed.reviewedContentSha256).toMatch(/^[a-f0-9]{64}$/);

    const before = document[key] as Json[];
    const written = after[key] as Json[];
    expect(Object.keys(after)).toEqual(Object.keys(document));
    for (const other of Object.keys(document).filter((name) => name !== key)) {
      expect(after[other], other).toEqual(document[other]);
    }
    const index = collectionOf(kind, document).findIndex((entry: Json) => entry.id === record.id);
    expect(written).toHaveLength(before.length);
    written.forEach((entry, position) => {
      if (position !== index) expect(entry, `record ${position}`).toEqual(before[position]);
    });
    expect(written[index]).toEqual({
      ...before[index],
      status: "reviewed",
      reviewedBy: REVIEWER,
      reviewedAt: REVIEWED_AT,
      reviewedContentSha256: signed.reviewedContentSha256,
    });

    const reread = collectionOf(kind, after).find((entry: Json) => entry.id === record.id);
    expect(recordPinState(reread, kind, context)).toBe("current");
    expect(reviewProblems(collectionOf(kind, after), kind, { ...context, now: NOW })).toEqual([]);
    expect(signOffQueue(kind, collectionOf(kind, after), context)).not.toContain(record.id);
  });

  it("display shows everything the site shows for each record", () => {
    for (const record of records()) {
      const shown = JSON.stringify(display[kind](record, context));
      const siteText =
        kind === "standard"
          ? [record.title, record.summary, record.sourceUrl]
          : [record.text, CULTURAL_NOTE_LABELS[record.kind as FormCulturalNote["kind"]], `Form ${record.formCode}`];
      for (const text of siteText)
        expect(shown, `${record.id}: ${String(text)}`).toContain(JSON.stringify(text).slice(1, -1));
    }
  });
});

describe("standard: the pin covers what /forms/act shows", () => {
  const document = readDocument("data/chief-psychiatrist-standards.json");
  const { signed, after } = sign("standard", document, firstSignable("standard", document));
  const edited = (change: Json) => recordPinState({ ...signed, ...change }, "standard", context);

  it("goes stale when the title, summary or link changes", () => {
    expect(edited({})).toBe("current");
    expect(edited({ title: `${signed.title} ` })).toBe("stale");
    expect(edited({ summary: `${signed.summary} Extra.` })).toBe("stale");
    expect(edited({ sourceUrl: "https://www.chiefpsychiatrist.wa.gov.au/other/" })).toBe("stale");
  });

  it("the page shows the signed standard as reviewed by its reviewer, and the rest unchanged", () => {
    const parsed = parseChiefPsychiatristStandards(after) ?? [];
    const unsigned = parseChiefPsychiatristStandards(document) ?? [];
    for (const [position, entry] of parsed.entries()) {
      if (entry.id === signed.id) expect([entry.reviewed, entry.reviewedBy]).toEqual([true, REVIEWER]);
      else expect(entry).toEqual(unsigned[position]);
    }
  });

  it("the page never shows Indigenous content as reviewed, even with a well-formed sign-off", () => {
    const aboriginal = (document.standards as Json[]).find((entry) => entry.id === "cp-standard-aboriginal-practice");
    const forged = { ...aboriginal, status: "reviewed", reviewedBy: REVIEWER, reviewedAt: REVIEWED_AT };
    const parsed = parseChiefPsychiatristStandards({
      standards: [{ ...forged, reviewedContentSha256: signed.reviewedContentSha256 }],
    });
    expect(parsed?.[0]).toMatchObject({ reviewed: false, reviewedBy: null });
  });
});

describe("cultural-note: the pin covers what a form page shows", () => {
  const document = readDocument("data/forms-cultural-notes.json");
  const target = firstSignable("cultural-note", document);
  const { signed, after } = sign("cultural-note", document, target);
  const edited = (change: Json) => recordPinState({ ...signed, ...change }, "cultural-note", context);

  it("goes stale when the text, label, kind, form or source changes", () => {
    expect(edited({})).toBe("current");
    expect(edited({ text: `${signed.text} ` })).toBe("stale");
    expect(edited({ label: "Something else" })).toBe("stale");
    expect(edited({ kind: "statutory", label: "Mental Health Act" })).toBe("stale");
    expect(edited({ formCode: "9Z" })).toBe("stale");
    expect(edited({ sourceId: "another-source" })).toBe("stale");
  });

  it("stays current when the file is reordered, because the positional id is not pinned", () => {
    const notes = after.notes as Json[];
    const reordered = { notes: [...notes].reverse() };
    const moved = collectionOf("cultural-note", reordered).find((entry: Json) => entry.status === "reviewed");
    expect(moved.text).toBe(target.text);
    expect(recordPinState(moved, "cultural-note", context)).toBe("current");
  });

  it("refuses to write onto a note whose words changed between reading and signing", () => {
    const drifted = clone(document);
    const index = collectionOf("cultural-note", document).findIndex((entry: Json) => entry.id === target.id);
    (drifted.notes as Json[])[index].text = "Changed after the pack was read.";
    expect(() => applyClinicalReview(drifted, "cultural-note", signed)).toThrow(/no longer matches/);
  });

  it("the form page shows the signed note as reviewed by its reviewer, and the rest unchanged", () => {
    const index = collectionOf("cultural-note", document).findIndex((entry: Json) => entry.id === target.id);
    const before = document.notes as FormCulturalNote[];
    (after.notes as FormCulturalNote[]).forEach((note, position) => {
      const expected = position === index ? REVIEWER : culturalNoteReviewer(before[position]);
      expect(culturalNoteReviewer(note), `${note.formCode} ${note.kind}`).toBe(expected);
    });
  });

  it("the form page never shows an Indigenous note as reviewed, even with a well-formed sign-off", () => {
    for (const note of document.notes as FormCulturalNote[]) {
      const forged = {
        ...note,
        status: "reviewed" as const,
        reviewedBy: REVIEWER,
        reviewedAt: REVIEWED_AT,
        reviewedContentSha256: "a".repeat(64),
      };
      const held = Boolean(indigenousContentTerm({ ...note, label: CULTURAL_NOTE_LABELS[note.kind] }));
      expect(culturalNoteReviewer(forged), `${note.formCode} ${note.kind}`).toBe(held ? null : REVIEWER);
    }
  });

  it("the tool pins the same labels the page prints", () => {
    expect(PINNED_CULTURAL_NOTE_LABELS).toEqual(CULTURAL_NOTE_LABELS);
  });
});

describe("the site's Indigenous-content check is at least as broad as the sign-off tool's", () => {
  it("flags every record the tool holds", () => {
    const standards = readDocument("data/chief-psychiatrist-standards.json").standards as Json[];
    for (const entry of standards) {
      if (indigenousContentIn(entry, "standard", context)) {
        expect(isIndigenousContent([entry.title, entry.summary]), String(entry.id)).toBe(true);
      }
    }
    for (const note of readDocument("data/forms-cultural-notes.json").notes as FormCulturalNote[]) {
      const shown = [CULTURAL_NOTE_LABELS[note.kind], note.text];
      if (indigenousContentTerm({ ...note, label: shown[0] })) {
        expect(note.kind === "aboriginal-liaison" || isIndigenousContent(shown), note.text).toBe(true);
      }
    }
  });

  it.each([
    "Aboriginal",
    "Torres Strait",
    "First Nations",
    "First Peoples",
    "Indigenous",
    "SEWB",
    "social and emotional wellbeing",
    "13YARN",
    "Thirrili",
    "yarning",
    "yarn",
    "Koori",
    "Noongar",
    "Nyoongar",
    "Stolen Generations",
    "Culture Care Connect",
    "ACCHO",
    "ACCHS",
    "community-controlled",
    "community controlled",
  ])("flags %s", (term) => {
    expect(indigenousContentTerm(`Refer via ${term} services.`)).toBeTruthy();
    expect(isIndigenousContent([`Refer via ${term} services.`])).toBe(true);
  });
});

describe("npm run clinical:review lists and packs both kinds", () => {
  const run = async (argv: string[], root = ROOT) => {
    let text = "";
    const output = { write: (chunk: string) => ((text += chunk), true) };
    const status = await main(argv, { root, output, errorOutput: output });
    return { status, text };
  };

  let packRoot: string;
  beforeAll(() => {
    packRoot = mkdtempSync(join(tmpdir(), "signoff-standards-"));
    for (const path of ["data/chief-psychiatrist-standards.json", "src/data/source-acquisitions.json"]) {
      mkdirSync(dirname(join(packRoot, path)), { recursive: true });
      writeFileSync(join(packRoot, path), readFileSync(join(ROOT, path)));
    }
  });
  afterAll(() => rmSync(packRoot, { recursive: true, force: true }));

  it("--kind standard lists the standards", async () => {
    const { status, text } = await run(["--kind", "standard"]);
    expect(status).toBe(0);
    expect(text).toMatch(
      /Chief Psychiatrist's Standards for Clinical Care \(data\/chief-psychiatrist-standards\.json\): \d+ of 8 signed off/,
    );
  });

  it("--kind cultural-note lists the notes", async () => {
    const { status, text } = await run(["--kind", "cultural-note"]);
    expect(status).toBe(0);
    expect(text).toMatch(/\(data\/forms-cultural-notes\.json\): \d+ of 23 signed off/);
  });

  it("--pack --kind standard writes sign-off-packs/standard.html", async () => {
    const { status, text } = await run(["--pack", "--kind", "standard"], packRoot);
    expect(status).toBe(0);
    const standards = collectionOf("standard", readDocument("data/chief-psychiatrist-standards.json")) as Json[];
    const [next] = signOffQueue("standard", standards, context);
    if (!next) {
      expect(text).toContain("Nothing waiting");
      return;
    }
    const pack = readFileSync(join(packRoot, "sign-off-packs", "standard.html"), "utf8");
    expect(text).toContain("standard.html");
    const title = String(standards.find((entry) => entry.id === next)?.title);
    expect(pack).toContain(title.slice(title.indexOf(":") + 1).trim());
  });
});
