import type { AppModeId } from "@/lib/app-modes";
import type { UniversalSearchDomain } from "@/lib/universal-search-domains";

const preferredDomainsByMode: Record<AppModeId, readonly UniversalSearchDomain[]> = {
  answer: ["documents"],
  documents: ["documents"],
  services: ["services"],
  forms: ["forms"],
  favourites: [],
  differentials: ["differentials", "presentations"],
  dsm: ["dsm"],
  specifiers: ["specifiers"],
  formulation: ["formulation"],
  prescribing: ["medications", "documents"],
  tools: ["tools"],
  // Calculators searches its local, session-aware catalogue rather than the
  // cross-entity index, so it has no universal-search domain preference.
  calculators: [],
  // Therapy Compass leads with its own therapy library, exposed to cross-entity
  // search as the "therapies" domain.
  "therapy-compass": ["therapies"],
  // Factsheets searches its own local patient-information library, not a
  // cross-entity search domain, so it declares no preferred universal domains.
  factsheets: [],
  dictionary: ["dictionary"],
};

const modeByDomain: Record<UniversalSearchDomain, AppModeId> = {
  documents: "documents",
  medications: "prescribing",
  services: "services",
  forms: "forms",
  differentials: "differentials",
  presentations: "differentials",
  specifiers: "specifiers",
  formulation: "formulation",
  dsm: "dsm",
  therapies: "therapy-compass",
  dictionary: "dictionary",
  tools: "tools",
};

export function universalSearchPreferredDomains(mode: AppModeId | undefined): UniversalSearchDomain[] {
  return mode ? [...preferredDomainsByMode[mode]] : [];
}

export function universalSearchDomainBelongsToMode(domain: UniversalSearchDomain, mode: AppModeId): boolean {
  return preferredDomainsByMode[mode].includes(domain);
}

export function universalSearchModeForDomain(domain: UniversalSearchDomain): AppModeId {
  return modeByDomain[domain];
}
