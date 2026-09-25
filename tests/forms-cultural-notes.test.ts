import { describe, expect, it } from "vitest";

import formsCatalog from "../data/forms-catalog.json";
import formsCulturalNotes from "../data/forms-cultural-notes.json";

import { culturalNotesForForm, type FormCulturalNote } from "@/lib/forms-cultural-notes";

/**
 * `data/forms-cultural-notes.json` is a shared-interface contract
 * (plan-v2.md "Shared-interface contracts"): `{notes: [{formCode, kind,
 * text, sourceId, status}]}`. These tests pin that shape, that every note
 * is still drafted (never a self-attested review), that every citation is a
 * well-formed ledger id, and that the render hook filters by form code
 * correctly.
 *
 * The three sourceIds cited here (`mha-2014-communication-and-cultural-provisions`,
 * `wa-health-language-services-policy-2011`, `cp-clinical-care-standard-aboriginal-practice`)
 * are captured, with full metadata and quoted text, in
 * `.superpowers/sdd/plan/sources-t7b.json` — outside this repo's tracked tree, per the
 * builder protocol, until the integrator appends it to `src/data/source-acquisitions.json`.
 * That append, and `npm run check:source-acquisitions`, are the integration-time proof that
 * these ids resolve to real, complete records; this test only pins this file's own shape.
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

  it("every note has the exact required fields and nothing else", () => {
    for (const note of notes) {
      expect(Object.keys(note).sort()).toEqual(["formCode", "kind", "sourceId", "status", "text"]);
    }
  });

  it("every note is drafted — no agent-recorded review", () => {
    for (const note of notes) {
      expect(note.status, `${note.formCode} ${note.kind} must be drafted`).toBe("drafted");
    }
  });

  it("every note's kind is interpreter or aboriginal-liaison", () => {
    for (const note of notes) {
      expect(["interpreter", "aboriginal-liaison"]).toContain(note.kind);
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

  it("covers every required form with at least one interpreter and one aboriginal-liaison note", () => {
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
