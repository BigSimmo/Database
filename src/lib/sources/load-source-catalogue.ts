import "server-only";

import { canonicalizeSourceReferences, compareClinicalSources } from "@/lib/sources/catalogue-core";
import type { ClinicalSourceCatalogueEntry, ClinicalSourceReferenceInput } from "@/lib/sources/catalogue-types";
import { loadVisibleDocumentSourceReferences } from "@/lib/sources/document-source-loader";
import { repositorySourceReferences } from "@/lib/sources/repository-providers";

export type LoadedSourceCatalogue = {
  entries: ClinicalSourceCatalogueEntry[];
  hostedDocuments: "available" | "unavailable";
};

let cachedRepositoryEntries: ClinicalSourceCatalogueEntry[] | null = null;

/**
 * The repository half of the catalogue, canonicalised once per process.
 *
 * `repositorySourceReferences()` is assembled entirely from static ESM imports
 * — twelve bundled datasets, evaluated at module scope. Nothing in that path
 * reads the request, the viewer, the database or the clock, so canonicalising
 * it is a pure function of the deployed code: two requests served by the same
 * build can only ever produce the same 866 entries. That is what makes a
 * module-level memo correct here rather than merely convenient — the cache key
 * is the build, and a new build is a new process. Before this, all four Sources
 * routes rebuilt it independently on every request, at roughly 450 ms of
 * blocking server CPU each.
 */
function repositoryCatalogueEntries(): ClinicalSourceCatalogueEntry[] {
  cachedRepositoryEntries ??= canonicalizeSourceReferences(repositorySourceReferences());
  return cachedRepositoryEntries;
}

/**
 * True when some provider has started emitting a `documentId`, which would
 * break the disjointness the merge below depends on. Computed from the same
 * memoised references, so it costs one pass on the first request only.
 */
function repositoryDeclaresDocumentIds(): boolean {
  return repositorySourceReferences().some((reference) => Boolean(reference.documentId));
}

/**
 * Fold the viewer's hosted documents into the memoised repository catalogue.
 *
 * `canonicalizeSourceReferences` groups references by `baseIdentity`, and a
 * document reference's identity is always `document:<id>` because
 * `documentRowsToSourceReferences` always sets `documentId`. No repository
 * provider sets one, so the two halves land in disjoint identity groups and
 * neither can alter the other's merge, partitioning or warnings. Canonicalising
 * the document half on its own and re-sorting the concatenation therefore
 * yields exactly the array the whole-catalogue build produced — `sort` is
 * stable, and each half arrives already in that order.
 *
 * If that premise ever stops holding, fall back to the whole-catalogue build
 * rather than quietly returning a different catalogue.
 */
function mergeDocumentSources(
  repositoryEntries: ClinicalSourceCatalogueEntry[],
  documentReferences: readonly ClinicalSourceReferenceInput[],
): ClinicalSourceCatalogueEntry[] {
  if (documentReferences.length === 0) return repositoryEntries;
  if (repositoryDeclaresDocumentIds()) {
    return canonicalizeSourceReferences([...repositorySourceReferences(), ...documentReferences]);
  }
  return [...repositoryEntries, ...canonicalizeSourceReferences(documentReferences)].sort(compareClinicalSources);
}

export async function loadSourceCatalogue(): Promise<LoadedSourceCatalogue> {
  const documents = await loadVisibleDocumentSourceReferences();
  return {
    entries: mergeDocumentSources(repositoryCatalogueEntries(), documents.references),
    hostedDocuments: documents.availability,
  };
}

/** Test seam: drop the process-lifetime repository catalogue memo. */
export function clearSourceCatalogueCache() {
  cachedRepositoryEntries = null;
}
