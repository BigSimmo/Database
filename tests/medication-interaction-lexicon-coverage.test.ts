// Regression pins for the curated interaction lexicon.
//
// The lexicon is hand-maintained, so the failure it invites is silent decay: an
// edit that narrows a selector, or a catalogue refresh that renames a subclass,
// quietly turns resolved rows into unresolved ones. Unresolved rows render grey
// rather than green, so decay is fail-safe — but it is still a loss of function
// nobody would notice without a pin.
//
// The counts below are therefore RATCHETS, not exact expectations: resolution
// may improve freely, and any regression has to be justified by editing this
// file deliberately.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { INTERACTION_LEXICON, selectCatalogueSlugs, type LexiconTerm } from "@/lib/medication-interaction-lexicon";
import { loadMedicationSnapshot } from "@/lib/medication-snapshot";

type IndexRow = {
  rowKey: string;
  rowIndex: number;
  severity: string;
  counterparties: string[];
  termIds: string[];
  resolved: boolean;
};

const index = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "data/medication-interaction-index.json"), "utf8"),
) as {
  sourceRowCount: number;
  stats: { resolvedRows: number; unresolvedRows: number; rowsWithCatalogueTarget: number };
  bySlug: Record<string, { rows: IndexRow[]; unresolvedRowCount: number }>;
};

const records = loadMedicationSnapshot();

function term(id: string): LexiconTerm {
  const found = INTERACTION_LEXICON.find((item) => item.id === id);
  if (!found) throw new Error(`Lexicon term "${id}" not found`);
  return found;
}

function slugsFor(id: string): string[] {
  const found = term(id);
  return found.select ? selectCatalogueSlugs(found.select, records) : [];
}

describe("interaction lexicon coverage", () => {
  it("does not regress the number of resolved rows", () => {
    // Ratchet, but read it carefully: `resolvedRows` moves for TWO reasons, and
    // only one of them is coverage.
    //
    // It fell from 400 to 355 when a row containing any unenumerated mechanism
    // term became unresolved even if it also matched a named drug. Previously
    // "CYP3A4 inhibitors (Clarithromycin, Ketoconazole)" resolved on
    // clarithromycin and counted as fully read, quietly implying the whole
    // mechanism class had been checked. Fewer resolved rows there means more
    // medications held at grey — a tightening, not a loss.
    //
    // So: a drop is only acceptable alongside a deliberate semantics change,
    // recorded here and in the PR. Track raw drug-matching separately, which
    // rose 381 → 417 over the same period and is the number that must never
    // fall without explanation.
    expect(index.stats.resolvedRows).toBeGreaterThanOrEqual(358);
    expect(index.stats.rowsWithCatalogueTarget).toBeGreaterThanOrEqual(420);
    expect(index.sourceRowCount).toBeGreaterThanOrEqual(523);
  });

  it("keeps every unresolved row visible rather than dropping it", () => {
    const rowTotal = Object.values(index.bySlug).reduce((total, entry) => total + entry.rows.length, 0);
    expect(index.stats.resolvedRows + index.stats.unresolvedRows).toBe(rowTotal);
    expect(rowTotal).toBe(index.sourceRowCount);
  });

  it("marks a row unresolved when its only counterparty is an unenumerable mechanism", () => {
    const mechanismIds = new Set(
      INTERACTION_LEXICON.filter((item) => item.kind === "mechanism").map((item) => item.id),
    );
    const mechanismOnly = Object.values(index.bySlug)
      .flatMap((entry) => entry.rows)
      .filter(
        (row) =>
          row.termIds.length > 0 && row.counterparties.length === 0 && row.termIds.every((id) => mechanismIds.has(id)),
      );
    expect(mechanismOnly.length).toBeGreaterThan(0);
    expect(mechanismOnly.every((row) => !row.resolved)).toBe(true);
  });

  it("addresses a real catalogue row from every rowIndex it emits", () => {
    // `note` is intentionally not duplicated into the index; the UI recovers the
    // verbatim text by indexing into the record. That only works if every
    // emitted rowIndex still addresses a real row, so pin it for all 523.
    for (const [slug, entry] of Object.entries(index.bySlug)) {
      const record = records.find((item) => item.slug === slug);
      const sourceRows = record?.sections.find((section) => section.type === "inter")?.rows ?? [];
      for (const row of entry.rows) {
        const source = sourceRows[row.rowIndex];
        expect(source, `${slug} row ${row.rowIndex} does not address a catalogue row`).toBeDefined();
        expect(source?.key).toBe(row.rowKey);
        expect((source?.val ?? "").trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("lexicon deny-lists (the traps this module exists for)", () => {
  it("never resolves clozapine or olanzapine as a benzodiazepine", () => {
    // Their subclasses are "SGA / Dibenzodiazepine" and "SGA / Thienobenzodiazepine".
    const benzos = slugsFor("benzodiazepines");
    expect(benzos).toContain("diazepam");
    expect(benzos).not.toContain("clozapine");
    expect(benzos).not.toContain("olanzapine-wafer-odt");
    expect(benzos.every((slug) => !slug.startsWith("clozapine"))).toBe(true);
  });

  it("never resolves an opioid antagonist as an opioid", () => {
    const opioids = slugsFor("opioids");
    expect(opioids).toContain("methadone");
    expect(opioids).not.toContain("naltrexone");
    expect(opioids).not.toContain("naloxone");
  });

  it("never resolves a carbapenem antibiotic as an ARB", () => {
    // "ARB" is a substring of "C-arb-apenem". `subclassIncludes` is a substring
    // match, so it swept ertapenem and meropenem into the ARB class across 16
    // CRITICAL/HIGH rows until the review report surfaced it. The selector is
    // `subclassEquals` now; this pins the outcome by name.
    const arbs = slugsFor("arbs");
    expect(arbs).toContain("candesartan");
    expect(arbs).not.toContain("ertapenem");
    expect(arbs).not.toContain("meropenem");
    expect(arbs.every((slug) => records.find((item) => item.slug === slug)?.class !== "Antibiotic")).toBe(true);
  });

  it("keeps every subclass substring token a whole-word match", () => {
    // The systemic form of the ARB trap: a `subclassIncludes` token that only
    // appears inside a longer word is matching by accident. Legitimate uses —
    // "NSAID" inside "NSAID (COX-2 preferential)" — are whole words.
    const subclasses = Array.from(new Set(records.map((record) => record.subclass ?? "").filter(Boolean)));
    const accidental: string[] = [];
    for (const term of INTERACTION_LEXICON) {
      for (const token of term.select?.subclassIncludes ?? []) {
        const tokenWords = token
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean);
        for (const subclass of subclasses) {
          if (!subclass.toLowerCase().includes(token.toLowerCase())) continue;
          const words = subclass
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter(Boolean);
          if (!tokenWords.every((part) => words.includes(part))) {
            accidental.push(`${term.id}: "${token}" inside "${subclass}"`);
          }
        }
      }
    }
    expect(accidental).toEqual([]);
  });

  it("reaches lithium from the rows that name it", () => {
    // The catalogue record is "Lithium carbonate (IR/SR)", so the name-derived
    // surfaces never included the bare word every row actually uses. Lithium was
    // named in eight HIGH rows and reachable from none — the worst silence in a
    // psychiatry catalogue. Pinned by counterparty, not by resolved-row count,
    // because a count can be met by unrelated coverage elsewhere.
    const lithium = "lithium-carbonate-ir-sr";
    const reachedFrom = Object.entries(index.bySlug)
      .filter(([, entry]) => entry.rows.some((row) => row.counterparties.includes(lithium)))
      .map(([slug]) => slug);
    for (const slug of ["diclofenac", "meloxicam", "naproxen", "frusemide", "hydrochlorothiazide", "indapamide"]) {
      expect(reachedFrom, `${slug} should reach lithium`).toContain(slug);
    }
    expect(slugsFor("lithium")).toEqual([lithium]);
  });

  it("has no lexicon term that can never fire", () => {
    // `z-drugs` was exactly this: a term whose phrasing appears nowhere in the
    // corpus, implying coverage the tool did not have. A dead term is not
    // dangerous on its own, but it makes the review sheet claim a class was
    // considered when nothing can ever match it.
    const fired = new Set(
      Object.values(index.bySlug)
        .flatMap((entry) => entry.rows)
        .flatMap((row) => row.termIds),
    );
    const dead = INTERACTION_LEXICON.filter((item) => !fired.has(item.id)).map((item) => item.id);
    expect(dead).toEqual([]);
  });

  it("keeps the divergent duplicate Warfarin records visible", () => {
    // The catalogue holds two records named "Warfarin" whose interaction rows
    // have nothing in common, so which one a clinician opens changes which
    // warnings they see. That is a catalogue defect, not a lexicon one, and it
    // is deliberately left unpatched pending a clinical decision — but it must
    // not become invisible. If someone reconciles the records, this test goes
    // red and the review sheet's flag can be retired with it.
    const duplicates = records.filter((record) => record.name === "Warfarin");
    expect(duplicates.map((record) => record.slug).sort()).toEqual(["warfarin-anticoagulant", "warfarin-vka"]);

    const rowSet = (slug: string) =>
      new Set(
        (
          records.find((record) => record.slug === slug)?.sections.find((section) => section.type === "inter")?.rows ??
          []
        ).map((row) => `${row.key}::${row.val}`),
      );
    const [a, b] = [rowSet("warfarin-vka"), rowSet("warfarin-anticoagulant")];
    expect(a.size).toBeGreaterThan(0);
    expect(b.size).toBeGreaterThan(0);
    expect([...a].filter((row) => b.has(row))).toEqual([]);
  });

  it("resolves beta blockers across both catalogue spellings", () => {
    const betaBlockers = slugsFor("beta-blockers");
    // "Beta Blocker" (metoprolol) and "Beta-Blocker" (propranolol).
    expect(betaBlockers).toContain("metoprolol");
    expect(betaBlockers).toContain("propranolol");
  });

  it("prefers the specific class over the generic one", () => {
    const thiazides = slugsFor("thiazide-diuretics");
    const loops = slugsFor("loop-diuretics");
    expect(thiazides.length).toBeGreaterThan(0);
    expect(loops.length).toBeGreaterThan(0);
    expect(thiazides.some((slug) => loops.includes(slug))).toBe(false);
  });
});

describe("non-drug and external terms", () => {
  const nonMatching = INTERACTION_LEXICON.filter(
    (item) => item.kind === "nonDrug" || item.kind === "external" || item.kind === "mechanism",
  );

  it("never resolves to a catalogue medication", () => {
    for (const item of nonMatching) {
      expect(item.select, `${item.id} must not carry a catalogue selector`).toBeUndefined();
    }
  });

  it("classifies alcohol, grapefruit and smoking as non-drug", () => {
    for (const id of ["alcohol", "grapefruit", "smoking", "acidic-drinks"]) {
      expect(term(id).kind).toBe("nonDrug");
    }
  });

  it("classifies bare CYP and P-gp classes as unenumerable mechanisms", () => {
    for (const id of ["cyp-inhibitors", "cyp-inducers", "pgp", "cns-depressants"]) {
      expect(term(id).kind).toBe("mechanism");
    }
  });

  it("produces no counterparties for a row whose only term is non-drug", () => {
    // Clozapine's CRITICAL smoking row.
    const smokingRows = (index.bySlug.clozapine?.rows ?? []).filter((row) => row.termIds.includes("smoking"));
    expect(smokingRows.length).toBeGreaterThan(0);
    expect(smokingRows.every((row) => row.counterparties.length === 0)).toBe(true);
  });

  it("resolves a non-drug-only row rather than leaving it for manual review", () => {
    // "Smoking" is fully understood — it just is not a medicine. That is a
    // different thing from "we could not read this row", and must not push the
    // medication into the grey needs-review state.
    const smokingRows = (index.bySlug.clozapine?.rows ?? []).filter((row) => row.termIds.includes("smoking"));
    expect(smokingRows.every((row) => row.resolved)).toBe(true);
  });
});

describe("lexicon hygiene", () => {
  it("has unique term ids", () => {
    const ids = INTERACTION_LEXICON.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate surface across terms", () => {
    const surfaces = INTERACTION_LEXICON.flatMap((item) => item.surfaces.map((s) => s.toLowerCase()));
    expect(new Set(surfaces).size).toBe(surfaces.length);
  });

  it("gives every catalogue term a selector that actually matches something", () => {
    for (const item of INTERACTION_LEXICON.filter((entry) => entry.kind === "catalogue")) {
      expect(item.select, `${item.id} needs a selector`).toBeDefined();
      expect(slugsFor(item.id).length, `${item.id} resolved to nothing`).toBeGreaterThan(0);
    }
  });

  it("never lets a source medication appear as its own counterparty", () => {
    for (const [slug, entry] of Object.entries(index.bySlug)) {
      for (const row of entry.rows) {
        expect(
          row.counterparties.every((c) => c !== slug),
          `${slug} self-interacts`,
        ).toBe(true);
      }
    }
  });
});
