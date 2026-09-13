import "server-only";

import { canonicalizeSourceReferences } from "@/lib/sources/catalogue-core";
import type { ClinicalSourceCatalogueEntry } from "@/lib/sources/catalogue-types";
import { loadVisibleDocumentSourceReferences } from "@/lib/sources/document-source-loader";
import { repositorySourceReferences } from "@/lib/sources/repository-providers";

export type LoadedSourceCatalogue = {
  entries: ClinicalSourceCatalogueEntry[];
  hostedDocuments: "available" | "unavailable";
};

export async function loadSourceCatalogue(): Promise<LoadedSourceCatalogue> {
  const documents = await loadVisibleDocumentSourceReferences();
  return {
    entries: canonicalizeSourceReferences([...repositorySourceReferences(), ...documents.references]),
    hostedDocuments: documents.availability,
  };
}
