import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  canonicalizeSourceReferences,
  compareClinicalSources,
  groupSourceReferencesByIdentity,
} from "@/lib/sources/catalogue-core";
import type { ClinicalSourceCatalogueEntry, ClinicalSourceReferenceInput } from "@/lib/sources/catalogue-types";
import { documentRowsToSourceReferences } from "@/lib/sources/document-source-loader";
import { repositorySourceReferences } from "@/lib/sources/repository-providers";

const loadVisibleDocumentSourceReferences = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sources/document-source-loader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sources/document-source-loader")>();
  return { ...actual, loadVisibleDocumentSourceReferences };
});

const { clearSourceCatalogueCache, loadSourceCatalogue } = await import("@/lib/sources/load-source-catalogue");

/**
 * The accumulation `canonicalizeSourceReferences` used before 2026-09-16:
 * every insert replaced the bucket with a copy of itself plus the new member,
 * which is quadratic in bucket size across the ~1,767 repository references.
 *
 * Replayed here from the key assignment the real grouper produced, so the only
 * thing under comparison is the accumulation itself — the one step the fix
 * touched. If the linear version ever dropped, reordered or duplicated a
 * member, or emitted its keys in a different order, these Maps would differ.
 */
function replayQuadraticGrouping(
  inputs: readonly ClinicalSourceReferenceInput[],
  keyFor: ReadonlyMap<ClinicalSourceReferenceInput, string>,
) {
  const buckets = new Map<string, ClinicalSourceReferenceInput[]>();
  for (const input of inputs) {
    const key = keyFor.get(input);
    if (key === undefined) continue;
    buckets.set(key, [...(buckets.get(key) ?? []), input]);
  }
  return buckets;
}

function keyAssignment(buckets: ReadonlyMap<string, ClinicalSourceReferenceInput[]>) {
  const assignment = new Map<ClinicalSourceReferenceInput, string>();
  for (const [key, members] of buckets) {
    for (const member of members) assignment.set(member, key);
  }
  return assignment;
}

function documentReferences(): ClinicalSourceReferenceInput[] {
  return documentRowsToSourceReferences([
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Ward handover protocol",
      file_name: "handover.pdf",
      status: "indexed",
      metadata: { publisher: "North Metropolitan Health Service", publication_date: "2025-03-01" },
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Clozapine monitoring checklist",
      file_name: "clozapine.pdf",
      status: "indexed",
      metadata: { publisher: "RANZCP", version: "2" },
    },
  ]);
}

describe("repository source reference memoisation", () => {
  it("builds the provider references once per process", () => {
    const first = repositorySourceReferences();
    const second = repositorySourceReferences();

    // Identity, not deep equality: a second build would be a fresh array, and
    // the point of the memo is that no second build happens.
    expect(second).toBe(first);
    expect(first.length).toBeGreaterThan(1_000);
  });
});

describe("canonicalizeSourceReferences grouping", () => {
  it("accumulates identity groups exactly as the quadratic version did, over the real catalogue", () => {
    const references = repositorySourceReferences();
    const { identityGroups, unresolvedByKey } = groupSourceReferencesByIdentity(references);

    expect(replayQuadraticGrouping(references, keyAssignment(identityGroups))).toEqual(identityGroups);
    expect(replayQuadraticGrouping(references, keyAssignment(unresolvedByKey))).toEqual(unresolvedByKey);

    // `toEqual` on a Map compares entries pairwise in iteration order, so the
    // assertions above already pin first-seen key ordering. Restate the two
    // invariants the catalogue's entry ids depend on so a regression names
    // itself rather than printing a 1,767-entry diff.
    expect([...identityGroups.keys()]).toEqual([
      ...replayQuadraticGrouping(references, keyAssignment(identityGroups)).keys(),
    ]);
    expect([...identityGroups.values()].reduce((total, group) => total + group.length, 0)).toBe(
      references.length - [...unresolvedByKey.values()].reduce((total, group) => total + group.length, 0),
    );
  });

  it("returns a catalogue that is already in canonical order", () => {
    const entries = canonicalizeSourceReferences(repositorySourceReferences());
    const outOfOrder = entries
      .slice(1)
      .filter((entry, index) => compareClinicalSources(entries[index], entry) > 0)
      .map((entry) => entry.id);

    expect(entries.length).toBeGreaterThan(500);
    expect(outOfOrder).toEqual([]);
    // Entry ids are derived from the identity group, so a duplicate would mean
    // two groups collapsed into one — the failure the grouping test guards.
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  });
});

describe("loadSourceCatalogue", () => {
  beforeEach(() => {
    clearSourceCatalogueCache();
    loadVisibleDocumentSourceReferences.mockReset();
  });

  it("serves the repository catalogue from one build across requests", async () => {
    loadVisibleDocumentSourceReferences.mockResolvedValue({ references: [], availability: "available" });

    const first = await loadSourceCatalogue();
    const second = await loadSourceCatalogue();

    expect(first.entries).toEqual(canonicalizeSourceReferences(repositorySourceReferences()));
    expect(second.entries).toBe(first.entries);
    expect(second.hostedDocuments).toBe("available");
  });

  it("still reads hosted-document availability on every request", async () => {
    loadVisibleDocumentSourceReferences
      .mockResolvedValueOnce({ references: [], availability: "available" })
      .mockResolvedValueOnce({ references: [], availability: "unavailable" });

    expect((await loadSourceCatalogue()).hostedDocuments).toBe("available");
    expect((await loadSourceCatalogue()).hostedDocuments).toBe("unavailable");
    expect(loadVisibleDocumentSourceReferences).toHaveBeenCalledTimes(2);
  });

  it("folds hosted documents in without changing the whole-catalogue result", async () => {
    const documents = documentReferences();
    loadVisibleDocumentSourceReferences.mockResolvedValue({ references: documents, availability: "available" });

    const merged = await loadSourceCatalogue();
    const wholeCatalogue = canonicalizeSourceReferences([...repositorySourceReferences(), ...documents]);

    // The merge shortcut is only sound because document references occupy
    // identity groups no repository provider can reach. Deep equality against
    // the unsplit build is the proof.
    expect(merged.entries).toEqual(wholeCatalogue);
    expect(
      merged.entries.filter((entry: ClinicalSourceCatalogueEntry) => entry.contentMode === "indexed_content"),
    ).toHaveLength(documents.length);
  });

  it("does not let a request's documents leak into the next request", async () => {
    const documents = documentReferences();
    loadVisibleDocumentSourceReferences
      .mockResolvedValueOnce({ references: documents, availability: "available" })
      .mockResolvedValueOnce({ references: [], availability: "unavailable" });

    const withDocuments = await loadSourceCatalogue();
    const withoutDocuments = await loadSourceCatalogue();

    expect(withDocuments.entries.length).toBe(withoutDocuments.entries.length + documents.length);
    expect(withoutDocuments.entries).toEqual(canonicalizeSourceReferences(repositorySourceReferences()));
  });
});
