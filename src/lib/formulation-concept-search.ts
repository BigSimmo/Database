import formulationConceptIndexJson from "@/data/formulation-concept-index.json";
import { expandedSmartSearchQuery } from "@/lib/smart-search-intent";

/**
 * The client-side half of the concept library.
 *
 * `formulation-concepts.ts` holds the full records — evidence locators, source
 * limitations, review state, guide bodies — and the search surface is a client
 * component, so importing it there would download roughly 200 KB of
 * server-rendered prose to every visitor of `/formulation/search`. This module
 * reads a generated index carrying only what a result card and a search
 * haystack need, and `tests/formulation-concepts.test.ts` pins the index
 * against the full records so the two cannot drift.
 */
export type FormulationConceptIndexEntry = {
  id: string;
  title: string;
  kind: string;
  group: string;
  domains: string[];
  summary: string;
  searchTerms: string[];
};

export type FormulationConceptIndexGroup = {
  id: string;
  label: string;
  description: string;
};

const index = formulationConceptIndexJson as unknown as {
  groups: FormulationConceptIndexGroup[];
  concepts: FormulationConceptIndexEntry[];
};

/** Published concepts only. A record held for governance review is absent. */
export const formulationConceptIndex = index.concepts;
export const formulationConceptIndexGroups = index.groups;

export const formulationConceptDomainsInUse = Array.from(
  new Set(formulationConceptIndex.flatMap((concept) => concept.domains)),
);

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchText(concept: FormulationConceptIndexEntry) {
  return normalize(
    [concept.title, concept.kind, concept.summary, ...concept.domains, ...concept.searchTerms].join(" "),
  );
}

export type FormulationConceptResult = { concept: FormulationConceptIndexEntry; score: number };

/**
 * Deliberately a second, separate ranking rather than an extra branch inside
 * `searchFormulationMechanisms`: the mechanism weights are pinned by
 * `tests/formulation.test.ts`, and a contextual factor must never displace a
 * mechanism from the top of the list the mode is named for.
 */
export function searchFormulationConcepts(
  query: string,
  options: { domains?: ReadonlySet<string>; group?: string; interpretNaturalLanguage?: boolean } = {},
): FormulationConceptResult[] {
  const normalizedQuery = normalize(
    options.interpretNaturalLanguage ? expandedSmartSearchQuery("formulation", query) : query,
  );
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const domainFacets = options.domains;

  return formulationConceptIndex
    .map((concept, position) => {
      if (options.group && concept.group !== options.group) return null;
      if (domainFacets?.size && !concept.domains.some((domain) => domainFacets.has(domain))) return null;

      const haystack = searchText(concept);
      const title = normalize(concept.title);
      const terms = normalize(concept.searchTerms.join(" "));
      let score = normalizedQuery ? 0 : formulationConceptIndex.length - position;

      if (normalizedQuery) {
        if (title === normalizedQuery) score += 80;
        else if (title.includes(normalizedQuery)) score += 48;
        if (terms.includes(normalizedQuery)) score += 30;
        for (const token of queryTokens) {
          if (title.includes(token)) score += 14;
          if (terms.includes(token)) score += 8;
          if (haystack.includes(token)) score += 3;
        }
      }

      return score > 0 ? { concept, score } : null;
    })
    .filter((result): result is FormulationConceptResult => Boolean(result))
    .sort((left, right) => right.score - left.score || left.concept.title.localeCompare(right.concept.title, "en-AU"));
}
