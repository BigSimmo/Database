import { describe, expect, it } from "vitest";

import { canonicalizeSourceReferences } from "@/lib/sources/catalogue-core";
import { compareText as compareCatalogueViewText } from "@/lib/sources/catalogue-view";
import { repositorySourceReferences } from "@/lib/sources/repository-providers";

/**
 * The sources catalogue sorts with `Intl.Collator` instances built once at module
 * scope rather than calling `String.prototype.localeCompare(value, "en-AU", …)`,
 * which is specified as constructing a fresh collator on every call and dominated
 * this page's server time (72.8% of CPU samples on a 2,000-reference profile).
 *
 * The two forms are the same comparison by construction, so these tests pin that
 * equivalence rather than a snapshot of the order: a future edit that reintroduces
 * per-call `localeCompare`, or that changes the locale or sensitivity on one side
 * only, fails here instead of silently reordering a clinician's source list.
 */

/** The exact comparison the catalogue used before the collators were hoisted. */
function legacyCompareText(left: string, right: string) {
  return left.localeCompare(right, "en-AU", { sensitivity: "base" }) || left.localeCompare(right, "en-AU");
}

const COLLATION_SAMPLES = [
  "",
  " ",
  "a",
  "A",
  "alpha",
  "Alpha",
  "ALPHA",
  "Álpha",
  "Department of Health WA",
  "department of health wa",
  "DEPARTMENT OF HEALTH WA",
  "Lithium — monitoring",
  "Lithium - monitoring",
  "Ménière Institute",
  "Meniere Institute",
  "Résumé of care",
  "Resume of care",
  "RANZCP",
  "ranzcp",
  "NICE",
  "nice",
  "Zebra protocol",
  "zebra protocol",
  "10 mg",
  "2 mg",
] as const;

describe("source catalogue collation", () => {
  it("orders every sample pair exactly as the per-call localeCompare form did", () => {
    const sign = (value: number) => (value < 0 ? -1 : value > 0 ? 1 : 0);
    const divergent: string[] = [];
    for (const left of COLLATION_SAMPLES) {
      for (const right of COLLATION_SAMPLES) {
        if (sign(compareCatalogueViewText(left, right)) !== sign(legacyCompareText(left, right))) {
          divergent.push(`${JSON.stringify(left)} vs ${JSON.stringify(right)}`);
        }
      }
    }
    expect(divergent).toEqual([]);
  });

  it("sorts a sample list identically to the per-call form", () => {
    const shuffled = [...COLLATION_SAMPLES].reverse();
    expect([...shuffled].sort(compareCatalogueViewText)).toEqual([...shuffled].sort(legacyCompareText));
  });

  it("is case-insensitive first and case-sensitive only as a tiebreak", () => {
    // "base" sensitivity must not report a difference on case alone...
    expect(compareCatalogueViewText("alpha", "zebra")).toBeLessThan(0);
    expect(compareCatalogueViewText("ALPHA", "zebra")).toBeLessThan(0);
    // ...but the pair must still be totally ordered, so equal-ignoring-case
    // strings never compare equal and collapse in a Set-backed sort.
    expect(compareCatalogueViewText("alpha", "Alpha")).not.toBe(0);
  });

  it("canonicalizes the real repository catalogue deterministically", () => {
    const references = repositorySourceReferences();
    expect(references.length).toBeGreaterThan(0);

    const first = canonicalizeSourceReferences(references);
    const second = canonicalizeSourceReferences([...references]);

    // Stable across calls: nothing in the grouping depends on call order or on a
    // shared mutable group array.
    expect(second.map((entry) => entry.id)).toEqual(first.map((entry) => entry.id));
    expect(JSON.stringify(second)).toEqual(JSON.stringify(first));

    // Entry ids are unique: a shared group array would merge references that the
    // per-input grouping keeps apart.
    expect(new Set(first.map((entry) => entry.id)).size).toBe(first.length);
  });

  it("groups repeated identities without mutating a caller's array", () => {
    const references = repositorySourceReferences();
    const input = [...references, ...references];
    const before = JSON.stringify(input);
    canonicalizeSourceReferences(input);
    expect(JSON.stringify(input)).toEqual(before);
  });
});
