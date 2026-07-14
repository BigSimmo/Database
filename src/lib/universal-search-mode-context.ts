import type { AppModeId } from "@/lib/app-modes";
import type { UniversalSearchDomain } from "@/lib/universal-search-domains";

const preferredDomainsByMode: Record<AppModeId, readonly UniversalSearchDomain[]> = {
  answer: ["documents"],
  documents: ["documents"],
  services: ["services"],
  forms: ["forms"],
  favourites: [],
  differentials: ["differentials", "presentations"],
  specifiers: ["specifiers"],
  formulation: ["formulation"],
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
  specifiers: "specifiers",
  formulation: "formulation",
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
