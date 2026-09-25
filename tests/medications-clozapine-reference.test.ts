import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import sourceAcquisitions from "@/data/source-acquisitions.json";
import { getMedicationRecord } from "@/lib/medication-snapshot";
import type { MedicationSection, MedicationSectionRow } from "@/lib/medications";

/**
 * Proves the clozapine "wa" quoted reference block (task 6b): the section
 * exists, every row cites a `source:` tag, every cited id is a registered
 * source (either in this task's pre-integration fragment,
 * `.superpowers/sdd/plan/sources-t6b.json`, or already merged into the real
 * ledger at `src/data/source-acquisitions.json` — this test works in both
 * states so it survives the integrator's merge), and none of them cite the
 * rejected Rockingham Peel Group (RKPG) clozapine guideline (outstanding
 * issue #7VQ5RC — the document mislabels ANC thresholds as WBC).
 */

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * The builders' `sources-<task>.json` fragments are per-session scratch
 * files under `.superpowers/sdd/plan/`, which is not part of the git
 * history (see `.superpowers/sdd/plan/merge-sources.mjs`'s own header). A
 * worktree checkout nests a few directories below the location that holds
 * it, so this walks up from the test file looking for it rather than
 * assuming a fixed depth.
 */
function findSourcesFragment(): string | null {
  let dir = TEST_FILE_DIR;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, ".superpowers", "sdd", "plan", "sources-t6b.json");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

type AcquisitionFragmentRecord = {
  id: string;
  disposition: "adopted" | "candidate" | "rejected";
};

function loadFragmentEntries(): AcquisitionFragmentRecord[] {
  const fragmentPath = findSourcesFragment();
  if (!fragmentPath) return [];
  const raw = readFileSync(fragmentPath, "utf8");
  return JSON.parse(raw) as AcquisitionFragmentRecord[];
}

function extractSourceIds(row: MedicationSectionRow): string[] {
  return (row.tags ?? []).filter((tag) => tag.startsWith("source:")).map((tag) => tag.slice("source:".length));
}

function findWaSection(): MedicationSection {
  const record = getMedicationRecord("clozapine");
  expect(record, "clozapine record must exist in the medications snapshot").toBeTruthy();
  const section = record!.sections.find((candidate) => candidate.type === "wa");
  expect(section, "clozapine record must carry a 'wa' section").toBeTruthy();
  return section!;
}

describe("clozapine 'wa' quoted reference block (task 6b)", () => {
  it("adds exactly one 'wa' section titled 'Clozapine reference (quoted)'", () => {
    const record = getMedicationRecord("clozapine");
    expect(record).toBeTruthy();
    const waSections = record!.sections.filter((section) => section.type === "wa");
    expect(waSections).toHaveLength(1);
    expect(waSections[0]?.title).toBe("Clozapine reference (quoted)");
  });

  it("does not add a 'wa' section to another medication record", () => {
    // The clozapine record is this builder's only owned record; a light
    // sanity check that no neighbouring record picked one up by accident
    // (full snapshot count is pinned separately in tests/medications.test.ts).
    const record = getMedicationRecord("olanzapine-wafer-odt");
    expect(record).toBeTruthy();
    expect(record!.sections.some((section) => section.type === "wa")).toBe(false);
  });

  it("gives every row in the section a non-empty key and val", () => {
    const section = findWaSection();
    expect(section.rows.length).toBeGreaterThan(0);
    for (const row of section.rows) {
      expect(row.key.trim().length).toBeGreaterThan(0);
      expect(row.val.trim().length).toBeGreaterThan(0);
    }
  });

  it("cites a source id on every row, and every cited id is a registered source", () => {
    const section = findWaSection();
    const fragmentEntries = loadFragmentEntries();
    const registeredIds = new Set<string>([
      ...fragmentEntries.map((entry) => entry.id),
      ...(sourceAcquisitions as { id: string }[]).map((entry) => entry.id),
    ]);
    // At least one of the two sources (fragment or real ledger) must know
    // about ids at all, otherwise this assertion would pass vacuously.
    expect(
      registeredIds.size,
      "neither the sources-t6b.json fragment nor the real ledger could be loaded",
    ).toBeGreaterThan(0);

    for (const row of section.rows) {
      const sourceIds = extractSourceIds(row);
      expect(sourceIds.length, `row "${row.key}" must cite at least one source: tag`).toBeGreaterThan(0);
      for (const id of sourceIds) {
        expect(registeredIds.has(id), `row "${row.key}" cites unregistered source id "${id}"`).toBe(true);
      }
    }
  });

  it("cites only the accepted WA guideline, never the rejected RKPG source", () => {
    const section = findWaSection();
    const fragmentEntries = loadFragmentEntries();
    const rejectedIds = new Set(
      fragmentEntries.filter((entry) => entry.disposition === "rejected").map((entry) => entry.id),
    );

    for (const row of section.rows) {
      for (const id of extractSourceIds(row)) {
        expect(rejectedIds.has(id), `row "${row.key}" must not cite rejected source "${id}"`).toBe(false);
        expect(id, `row "${row.key}" must not cite the RKPG id by name`).not.toMatch(/rkpg/i);
      }
      // Belt and braces: no row's text may reference RKPG / Rockingham Peel by name either.
      expect(row.val, `row "${row.key}" text must not mention RKPG / Rockingham Peel`).not.toMatch(
        /RKPG|Rockingham Peel/i,
      );
    }
  });

  it("records the RKPG clozapine guideline as rejected somewhere in the source registers", () => {
    const fragmentEntries = loadFragmentEntries();
    const fromFragment = fragmentEntries.find(
      (entry) => entry.id === "rkpg-clozapine-policy-rejected-anc-wbc-mislabel",
    );
    const fromLedger = (sourceAcquisitions as { id: string; disposition: string }[]).find((entry) =>
      /rkpg/i.test(entry.id),
    );
    const recorded = fromFragment ?? fromLedger;
    expect(recorded, "RKPG rejection must be recorded in either sources-t6b.json or the real ledger").toBeTruthy();
    expect(recorded!.disposition).toBe("rejected");
  });

  it("covers all three requested sub-parts: titration, restart-after-missed-doses, and myocarditis monitoring", () => {
    const section = findWaSection();
    const keys = section.rows.map((row) => row.key);

    expect(keys.some((key) => /titration/i.test(key))).toBe(true);
    expect(keys.some((key) => /missed dose/i.test(key))).toBe(true);
    expect(keys.some((key) => /myocarditis/i.test(key))).toBe(true);
  });

  it("keeps every row's quote traceable to a bracketed source title", () => {
    const section = findWaSection();
    for (const row of section.rows) {
      expect(row.val, `row "${row.key}" must end with a bracketed source title`).toMatch(/\[[^[\]]+\]\s*$/);
    }
  });
});
