import type { CrossModeDifferentialCatalog } from "@/lib/cross-mode-links";
import { differentialPresentations, differentialRecords, differentialSearchAliases } from "@/lib/differentials";

// Load this module with a dynamic import only: it statically pulls the 1.2 MB
// differentials snapshot, which stays code-split out of the dashboard bundle.
export function crossModeDifferentialCatalog(): CrossModeDifferentialCatalog {
  return {
    diagnoses: differentialRecords.map((record) => ({
      slug: record.slug,
      title: record.title,
      clinicalHinge: record.clinicalHinge,
    })),
    presentations: differentialPresentations().map((presentation) => ({
      id: presentation.id,
      title: presentation.title,
      subtitle: presentation.subtitle,
    })),
    aliases: differentialSearchAliases(),
  };
}
