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
  // Legacy Specifiers mode still exists as a redirect entry; both it and Formulation
  // search against the shared "specifiers" domain (formulation mechanisms).
  specifiers: ["specifiers"],
  formulation: ["specifiers"],
  prescribing: ["medications", "documents"],
  tools: ["tools"],
};

const modeByDomain: Record<UniversalSearchDomain, AppModeId> = {
  documents: "documents",
  medications: "prescribing",
  services: "services",
  forms: "forms",
  differentials: "differentials",
  presentations: "differentials",
  dsm: "dsm",
  // Specifier-domain hits land in Formulation (canonical workspace).
  specifiers: "formulation",
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
