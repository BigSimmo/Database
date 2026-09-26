import { describe, expect, it } from "vitest";

import formsCatalog from "../data/forms-catalog.json";
import formsCulturalNotes from "../data/forms-cultural-notes.json";

import { culturalNotesForForm, type FormCulturalNote } from "@/lib/forms-cultural-notes";

/**
 * `data/forms-cultural-notes.json` is a shared-interface contract
 * (plan-v2.md "Shared-interface contracts"): `{notes: [{formCode, kind,
 * text, sourceId, status}]}`. These tests pin that shape, that an unsigned note
 * stays drafted and a signed one carries a complete sign-off, that every citation is a
 * well-formed ledger id, and that the render hook filters by form code
 * correctly.
 *
 * The sourceIds cited here (`mha-2014-communication-and-cultural-provisions`,
 * `wa-health-language-services-guidelines-2025`) are captured, with full metadata and
 * quoted text, in `.superpowers/sdd/plan/sources-t7b.json` — outside this repo's tracked
 * tree, per the builder protocol, until the integrator appends it to
 * `src/data/source-acquisitions.json`. That append, and `npm run check:source-acquisitions`,
 * are the integration-time proof that these ids resolve to real, complete records; this
 * test only pins this file's own shape. (The same fragment also records two rejected
 * captures — a superseded 2011 policy edition and a service-level standard that turned out
 * not to fit an examination form — neither of which any note cites.)
 */

type CatalogForm = { form: string };
const catalogFormCodes = new Set((formsCatalog as { forms: CatalogForm[] }).forms.map((form) => form.form));

const REQUIRED_FORM_CODES = ["1A", "3A", "3B", "3C", "4A", "6A"];
const notes = (formsCulturalNotes as { notes: FormCulturalNote[] }).notes;

// Mirrors the id pattern `acquisitionLedgerIssues` enforces
// (`src/lib/sources/acquisition-ledger.ts`): a lower-case hyphenated slug.
const LEDGER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("data/forms-cultural-notes.json shape", () => {
  it("is exactly {notes: [...]} with no other top-level keys", () => {
    expect(Object.keys(formsCulturalNotes as object)).toEqual(["notes"]);
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
  });

  it("every note has the exact required fields, plus the three sign-off fields once signed", () => {
    const base = ["formCode", "kind", "sourceId", "status", "text"];
    for (const note of notes) {
      const expected =
        note.status === "reviewed" ? [...base, "reviewedAt", "reviewedBy", "reviewedContentSha256"] : base;
      expect(Object.keys(note).sort()).toEqual(expected.sort());
    }
  });

  it("an unsigned note stays drafted; a signed one carries a reviewer, a timestamp and a 64-hex pin", () => {
    for (const note of notes) {
      const label = `${note.formCode} ${note.kind}`;
      expect(["drafted", "reviewed"], label).toContain(note.status);
      if (note.status !== "reviewed") continue;
      expect(note.reviewedBy?.trim(), `${label} reviewedBy`).toBeTruthy();
      expect(Number.isFinite(Date.parse(note.reviewedAt ?? "")), `${label} reviewedAt`).toBe(true);
      expect(note.reviewedContentSha256, `${label} pin`).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("every note's kind is interpreter, aboriginal-liaison or statutory", () => {
    for (const note of notes) {
      expect(["interpreter", "aboriginal-liaison", "statutory"]).toContain(note.kind);
    }
  });

  it("every note carries non-empty text and a sourceId", () => {
    for (const note of notes) {
      expect(note.text.trim().length, `${note.formCode} ${note.kind} text`).toBeGreaterThan(0);
      expect(note.sourceId.trim().length, `${note.formCode} ${note.kind} sourceId`).toBeGreaterThan(0);
    }
  });

  it("every note's sourceId is a well-formed ledger id", () => {
    for (const note of notes) {
      expect(LEDGER_ID_PATTERN.test(note.sourceId), `${note.formCode} ${note.kind} sourceId ${note.sourceId}`).toBe(
        true,
      );
    }
  });

  it("every note's formCode exists on the official forms register", () => {
    for (const note of notes) {
      expect(
        catalogFormCodes.has(note.formCode),
        `${note.formCode} is not a form code in data/forms-catalog.json`,
      ).toBe(true);
    }
  });

  it("covers every required form with at least one interpreter, aboriginal-liaison and statutory note", () => {
    for (const formCode of REQUIRED_FORM_CODES) {
      const forThisForm = notes.filter((note) => note.formCode === formCode);
      expect(
        forThisForm.some((note) => note.kind === "interpreter"),
        `${formCode} missing an interpreter note`,
      ).toBe(true);
      expect(
        forThisForm.some((note) => note.kind === "aboriginal-liaison"),
        `${formCode} missing an aboriginal-liaison note`,
      ).toBe(true);
      expect(
        forThisForm.some((note) => note.kind === "statutory"),
        `${formCode} missing a statutory note`,
      ).toBe(true);
    }
  });
});

describe("culturalNotesForForm", () => {
  it("returns only the notes for the requested form code", () => {
    const forOneA = culturalNotesForForm("1A");
    expect(forOneA.length).toBeGreaterThan(0);
    expect(forOneA.every((note) => note.formCode === "1A")).toBe(true);
  });

  it("returns an empty array for a form code with no cultural notes", () => {
    expect(culturalNotesForForm("2")).toEqual([]);
  });

  it("returns an empty array for a missing or empty form code", () => {
    expect(culturalNotesForForm(undefined)).toEqual([]);
    expect(culturalNotesForForm(null)).toEqual([]);
    expect(culturalNotesForForm("")).toEqual([]);
  });
});
