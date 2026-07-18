// Leaf module: the universal-search domain registry, split out so client code (the
// typeahead hook) can value-import the domain list without pulling the server-only
// search graph in universal-search.ts (snapshot catalogues, rag, supabase) into the
// browser bundle. universal-search.ts re-exports both names for server consumers.

export type UniversalSearchDomain =
  | "documents"
  | "medications"
  | "services"
  | "forms"
  | "differentials"
  | "presentations"
  | "dsm"
  | "specifiers"
  | "formulation"
  | "therapies"
  | "tools";

// Canonical order: the default group order in responses AND the topHit tiebreak when
// several domains hold a confident (whole-phrase title) match. "dsm" sits before
// "differentials" so that an exact match on a DSM catalogue entry (e.g. "major depressive
// disorder") resolves to the local DSM record instead of the Differentials catalogue, which
// also holds the same title. "presentations" sits after "differentials" so an exact
// diagnosis-title hit (e.g. "substance intoxication", which is both a diagnosis and an
// umbrella presentation title) wins Best match over the umbrella, while symptom phrases
// that only match a presentation title still promote the Presentations group to lead via
// confident-domain ordering.
export const universalSearchDomains: UniversalSearchDomain[] = [
  "documents",
  "medications",
  "services",
  "forms",
  "dsm",
  "differentials",
  "presentations",
  "specifiers",
  "formulation",
  // Therapies sit with the other local clinical-reasoning catalogues, ahead of the
  // catch-all tools group. Therapy titles ("Cognitive Behavioural Therapy (CBT)") do
  // not collide with other domains' titles, so this position only sets default group
  // order, not a topHit tiebreak.
  "therapies",
  "tools",
];
