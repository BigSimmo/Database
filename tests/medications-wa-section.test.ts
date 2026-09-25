// The WA prescribing rules added to the Medications catalogue (task t6a): a new
// `wa` section type on the psychostimulant, S8-benzodiazepine, opioid-substitution
// and gabapentinoid records, plus two corrections (the pregabalin "now Schedule 8"
// claim and the alprazolam "S8 permit" pearl).
//
// Three things this guards against, each a real way this content could go wrong
// silently:
//
// 1. A `wa` row citing a source id nobody captured. Every row's `val` ends with
//    `(<title>; source: <id>)`, and every `<id>` must resolve to a real captured
//    source — either in the shared register (`src/data/source-acquisitions.json`)
//    or in this builder's own capture fragment
//    (`.superpowers/sdd/plan/sources-t6a.json`, read from the session's plan
//    directory, not the worktree — the plan directory is gitignored and does not
//    exist in CI, so the fragment lookup is best-effort and the register lookup
//    alone must hold once the fragment is merged in at integration).
// 2. A new section `type` that `tabSectionTypes` (medication-nav-header.tsx)
//    doesn't know about, which the task brief calls out by name: it "silently
//    won't render" because `medicationSectionsByTab` simply drops any section
//    whose type matches no tab's set.
// 3. The pregabalin record still claiming, anywhere, that pregabalin is Schedule 8
//    in WA — it is Schedule 4, and the "now Schedule 8" clause was never sourced.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  medicationSectionsByTab,
  medicationTabForSectionType,
} from "@/components/clinical-dashboard/medication-nav-header";
import { getMedicationRecord } from "@/lib/medication-snapshot";
import type { MedicationRecord, MedicationSectionRow } from "@/lib/medications";

const repoRoot = path.resolve(process.cwd());

// The records this task adds a `wa` section to, plus how many rows each should
// carry (pinned so a future accidental row deletion/duplication is caught, not
// just "at least one row").
const WA_SECTION_RECORDS: { slug: string; rowCount: number }[] = [
  { slug: "methylphenidate", rowCount: 5 },
  { slug: "dexamfetamine", rowCount: 5 },
  { slug: "lisdexamfetamine", rowCount: 5 },
  { slug: "alprazolam", rowCount: 3 },
  { slug: "methadone", rowCount: 5 },
  { slug: "buprenorphine-sl-depot", rowCount: 6 },
  { slug: "buprenorphine-naloxone", rowCount: 5 },
  { slug: "gabapentin", rowCount: 3 },
  { slug: "pregabalin", rowCount: 3 },
];

/** `(<title>; source: <id>)` — the citation convention every `wa` row's `val` ends
 * with. Chosen over a `tags` entry: `medicationRowBadges` (`src/lib/medication-badges.ts`)
 * renders every tag as a literal, visible badge pill (`TAG_TONES[tag] ?? "info"` —
 * there is no filter for an unrecognised tag), and each row's badge cluster is
 * capped at 3–4 slots. A `source:<id>` tag would show a raw id string as a chip
 * and would crowd out a real clinical badge (PBS/TGA/OFF, a patient-context flag)
 * on every one of these rows. Citing the source in `val` — where a title already
 * has to appear per the task brief — costs no extra visible surface. */
const CITATION_PATTERN = /\(([^;()]+); source: ([a-z0-9-]+)\)$/;

function loadSourceAcquisitionIds(): Set<string> {
  const raw = readFileSync(path.join(repoRoot, "src/data/source-acquisitions.json"), "utf8");
  const records = JSON.parse(raw) as { id: string }[];
  return new Set(records.map((record) => record.id));
}

/** Best-effort: the plan directory is gitignored (`.superpowers/sdd/.gitignore`
 * excludes everything under `sdd/plan/`) and exists only on a builder's own
 * machine during this multi-agent sprint, never in CI or on a fresh checkout.
 * Once the integrator appends every `sources-*.json` fragment into
 * `src/data/source-acquisitions.json`, the register lookup alone covers these
 * ids and this glob simply finds nothing. */
function loadPlanFragmentIds(): Set<string> {
  const planDir = path.resolve(repoRoot, "..", "..", "..", ".superpowers", "sdd", "plan");
  const ids = new Set<string>();
  if (!existsSync(planDir)) return ids;
  for (const entry of readdirSync(planDir)) {
    if (!/^sources-.*\.json$/.test(entry)) continue;
    try {
      const records = JSON.parse(readFileSync(path.join(planDir, entry), "utf8")) as { id: string }[];
      for (const record of records) ids.add(record.id);
    } catch {
      // A fragment mid-write by another builder, or not valid JSON yet — not
      // this test's concern; the register lookup is the one that must hold.
    }
  }
  return ids;
}

const knownSourceIds = new Set([...loadSourceAcquisitionIds(), ...loadPlanFragmentIds()]);

function waSectionOf(record: MedicationRecord) {
  const sections = record.sections.filter((section) => section.type === "wa");
  expect(sections, `${record.slug} should have exactly one 'wa' section`).toHaveLength(1);
  return sections[0]!;
}

function citationOf(row: MedicationSectionRow) {
  const match = CITATION_PATTERN.exec(row.val);
  expect(
    match,
    `row ${JSON.stringify(row.key)} val should end with "(<title>; source: <id>)", got: ${row.val}`,
  ).not.toBeNull();
  return { title: match![1]!, sourceId: match![2]! };
}

describe("WA prescribing rules — medications catalogue (task t6a)", () => {
  it("clozapine is untouched (owned by a different builder)", () => {
    const clozapine = getMedicationRecord("clozapine");
    expect(clozapine).toBeDefined();
    expect(clozapine!.sections.some((section) => section.type === "wa")).toBe(false);
  });

  it("'wa' is registered in tabSectionTypes, in the safety tab group", () => {
    expect(medicationTabForSectionType("wa")).toBe("safety");
  });

  for (const { slug, rowCount } of WA_SECTION_RECORDS) {
    describe(slug, () => {
      const record = getMedicationRecord(slug);

      it("exists in the snapshot", () => {
        expect(record).toBeDefined();
      });

      it(`carries a 'wa' section with ${rowCount} row(s)`, () => {
        const section = waSectionOf(record!);
        expect(section.title).toBe("WA prescribing");
        expect(section.rows).toHaveLength(rowCount);
      });

      it("groups the 'wa' section into the safety tab, so it actually renders", () => {
        const byTab = medicationSectionsByTab(record!);
        expect(byTab.safety.some((section) => section.type === "wa")).toBe(true);
        // Not silently dropped into a tab nobody looks at, and not duplicated
        // into more than one tab.
        expect(byTab.summary.some((section) => section.type === "wa")).toBe(false);
        expect(byTab.dosing.some((section) => section.type === "wa")).toBe(false);
        expect(byTab.more.some((section) => section.type === "wa")).toBe(false);
      });

      it("every 'wa' row cites a source id that was actually captured", () => {
        const section = waSectionOf(record!);
        for (const row of section.rows) {
          const { sourceId } = citationOf(row);
          expect(
            knownSourceIds.has(sourceId),
            `unrecorded source id ${JSON.stringify(sourceId)} cited by ${slug} / ${JSON.stringify(row.key)}`,
          ).toBe(true);
        }
      });

      it("every 'wa' row has non-empty key, val and tags", () => {
        const section = waSectionOf(record!);
        for (const row of section.rows) {
          expect(row.key.trim().length).toBeGreaterThan(0);
          expect(row.val.trim().length).toBeGreaterThan(0);
          expect(row.tags).toEqual([]);
        }
      });
    });
  }

  describe("pregabalin correction", () => {
    const record = getMedicationRecord("pregabalin")!;

    it("no longer claims Schedule 8 anywhere in the record", () => {
      expect(JSON.stringify(record)).not.toContain("Schedule 8");
    });

    it("keeps the 'Bottom Line' summary row grammatical", () => {
      const summary = record.sections.find((section) => section.type === "summary")!;
      const bottomLine = summary.rows.find((row) => row.key === "Bottom Line")!;
      expect(bottomLine.val).toBe(
        "Pregabalin is effective for neuropathic pain, generalised anxiety, and fibromyalgia, but causes significant dizziness and weight gain.",
      );
    });

    it("keeps the quick 'Best Uses' row in sync with the summary row", () => {
      const bestUses = record.quick.find((row) => row.label === "Best Uses")!;
      const summary = record.sections.find((section) => section.type === "summary")!;
      const bottomLine = summary.rows.find((row) => row.key === "Bottom Line")!;
      expect(bestUses.value).toBe(bottomLine.val);
    });

    it("schedule field is still S4", () => {
      expect(record.schedule).toBe("S4");
    });
  });

  describe("alprazolam pearl correction", () => {
    const record = getMedicationRecord("alprazolam")!;

    it("no longer makes the unsourced 'S8 permit' discharge claim", () => {
      const serialized = JSON.stringify(record);
      expect(serialized).not.toContain("S8 permit");
      expect(serialized).not.toContain("without an S8 permit");
    });

    it("the 'The S8 Status' pearl row cites a captured source", () => {
      const pearl = record.sections.find((section) => section.type === "pearl")!;
      const row = pearl.rows.find((r) => r.key === "The S8 Status")!;
      const { sourceId } = citationOf(row);
      expect(knownSourceIds.has(sourceId)).toBe(true);
    });
  });
});
