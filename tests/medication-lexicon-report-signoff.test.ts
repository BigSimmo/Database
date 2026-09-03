// Binds the clinical sign-off on the lexicon review sheet to the mappings it covers.
//
// The sheet is the artefact that says which drug-class mappings a qualified
// reviewer accepted. Its sign-off block is human-maintained and carried forward
// verbatim by the generator, and `--check` deliberately ignores that block, so
// nothing detected that the mappings had moved underneath it: commit 0e70217cf
// (2026-08-28) added two medications and two deny-lists — `acei` went from one
// drug to two, `statins` from two to three, `fibrates` from two rows to one —
// while the sheet went on leading with "Status: reviewed 2026-08-22" and the
// gate stayed green.

import { describe, expect, it } from "vitest";

import { INTERACTION_LEXICON, selectCatalogueSlugs } from "@/lib/medication-interaction-lexicon";
import { loadMedicationSnapshot } from "@/lib/medication-snapshot";
import type { LexiconTerm } from "@/lib/medication-interaction-lexicon";
import { catalogueMappingsHash, parseSignOff, signOffStatusLine } from "../scripts/build-medication-lexicon-report";

const term = (id: string, surfaces: string[], denySlugs: string[] = [], sourceDenySlugs?: string[]): LexiconTerm =>
  ({ id, kind: "catalogue", surfaces, select: { slugs: [], denySlugs }, sourceDenySlugs }) as unknown as LexiconTerm;

describe("catalogueMappingsHash", () => {
  const terms = [term("acei", ["ACE inhibitors"]), term("statins", ["statins"])];
  const expansions = new Map<string, string[]>([
    ["acei", ["perindopril"]],
    ["statins", ["atorvastatin", "rosuvastatin"]],
  ]);

  it("is stable across ordering that carries no clinical meaning", () => {
    const reordered = new Map<string, string[]>([
      ["statins", ["rosuvastatin", "atorvastatin"]],
      ["acei", ["perindopril"]],
    ]);
    expect(catalogueMappingsHash([...terms].reverse(), reordered)).toBe(catalogueMappingsHash(terms, expansions));
  });

  it("changes when a term resolves to a drug it did not before", () => {
    // The exact shape of the 2026-08-28 change: ramipril entered the catalogue
    // and `acei` silently widened to two drugs.
    const widened = new Map(expansions).set("acei", ["perindopril", "ramipril"]);
    expect(catalogueMappingsHash(terms, widened)).not.toBe(catalogueMappingsHash(terms, expansions));
  });

  it("changes when a deny-list or a matched phrase changes", () => {
    const denied = [term("acei", ["ACE inhibitors"], ["ramipril"]), terms[1]!];
    const rephrased = [term("acei", ["ACE inhibitors", "ACEi"]), terms[1]!];
    expect(catalogueMappingsHash(denied, expansions)).not.toBe(catalogueMappingsHash(terms, expansions));
    expect(catalogueMappingsHash(rephrased, expansions)).not.toBe(catalogueMappingsHash(terms, expansions));
  });

  it("changes when a source-side exclusion changes", () => {
    // `sourceDenySlugs` decides which source records a term is allowed to fire
    // on, so editing one changes which rows raise an alert without changing any
    // surface or resolved target. The live statin and fibrate exclusions are
    // exactly this shape: they suppress otherwise false HIGH alerts on
    // simvastatin's and atorvastatin's own rows.
    const excluded = [term("statins", ["statins"], [], ["simvastatin"]), terms[0]!];
    const widened = [term("statins", ["statins"], [], ["simvastatin", "atorvastatin"]), terms[0]!];
    expect(catalogueMappingsHash(excluded, expansions)).not.toBe(catalogueMappingsHash(terms, expansions));
    expect(catalogueMappingsHash(widened, expansions)).not.toBe(catalogueMappingsHash(excluded, expansions));
  });

  it("hashes the live lexicon to a stable 64-character digest", () => {
    const records = loadMedicationSnapshot();
    const catalogueTerms = INTERACTION_LEXICON.filter((item) => item.kind === "catalogue");
    const live = new Map(
      catalogueTerms.map((item) => [item.id, item.select ? selectCatalogueSlugs(item.select, records) : []]),
    );
    const hash = catalogueMappingsHash(catalogueTerms, live);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(catalogueMappingsHash(catalogueTerms, live)).toBe(hash);
  });
});

describe("parseSignOff", () => {
  const block = [
    "## Sign-off",
    "",
    "| Field | Value |",
    "| --- | --- |",
    "| Reviewer (name + role) | Repository Lead |",
    "| Date | 2026-08-22 |",
    "| Outcome | All 37 catalogue terms reviewed. |",
  ].join("\n");

  it("reads the date and reports no hash for a sign-off recorded before the binding existed", () => {
    const signOff = parseSignOff(`# Sheet\n\n${block}\n`);
    expect(signOff.date).toBe("2026-08-22");
    expect(signOff.hash).toBe("");
  });

  it("reads a recorded mappings hash", () => {
    const hash = "a".repeat(64);
    const signOff = parseSignOff(`# Sheet\n\n${block}\n| Mappings hash | \`${hash}\` |\n`);
    expect(signOff.hash).toBe(hash);
  });

  it("treats a half-filled placeholder as no sign-off at all", () => {
    const signOff = parseSignOff(`# Sheet\n\n## Sign-off\n\n| Date | _not yet reviewed_ |\n`);
    expect(signOff).toEqual({ block: "", date: "", hash: "" });
  });
});

describe("signOffStatusLine", () => {
  const current = "b".repeat(64);

  it("says UNREVIEWED when nobody has signed", () => {
    expect(signOffStatusLine({ date: "", hash: "" }, current)).toMatch(/^\*\*Status: UNREVIEWED\.\*\*/);
  });

  it("keeps the reviewed wording, caveat included, when the sign-off covers these mappings", () => {
    const line = signOffStatusLine({ date: "2026-08-22", hash: current }, current);
    expect(line).toContain("**Status: reviewed 2026-08-22**");
    expect(line).not.toMatch(/NOT current/);
    // The sheet's existing scoping caveat must survive the change.
    expect(line).toContain("Any lexicon change made since is NOT covered by it");
  });

  it("does not present an unbound sign-off as a current review", () => {
    // This is the defect: the sheet led with a bare "Status: reviewed 2026-08-22"
    // over mappings that had changed six days later.
    const line = signOffStatusLine({ date: "2026-08-22", hash: "" }, current);
    expect(line).toContain("NOT current");
    expect(line).toContain("records no mappings hash");
    expect(line).toContain(current);
  });

  it("names both hashes when the mappings have moved since the sign-off", () => {
    const signed = "c".repeat(64);
    const line = signOffStatusLine({ date: "2026-08-22", hash: signed }, current);
    expect(line).toContain("NOT current");
    expect(line).toContain(signed);
    expect(line).toContain(current);
  });
});

describe("the committed review sheet", () => {
  it("states the sign-off is not current until it is re-recorded with a mappings hash", async () => {
    const { readFileSync } = await import("node:fs");
    const sheet = readFileSync("docs/medication-interaction-lexicon-review.md", "utf8");
    const records = loadMedicationSnapshot();
    const catalogueTerms = INTERACTION_LEXICON.filter((item) => item.kind === "catalogue");
    const live = new Map(
      catalogueTerms.map((item) => [item.id, item.select ? selectCatalogueSlugs(item.select, records) : []]),
    );
    const signOff = parseSignOff(sheet);
    const statusLine = sheet.split("\n").find((line) => line.startsWith("**Status:")) ?? "";

    expect(statusLine).toBe(signOffStatusLine(signOff, catalogueMappingsHash(catalogueTerms, live)));
    // The sign-off block itself is a human record and is never rewritten here.
    expect(signOff.date).toBe("2026-08-22");
  });
});
