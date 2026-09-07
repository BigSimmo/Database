import { appModeDefinition, appModeHomeHref, type AppModeId } from "@/lib/app-modes";
import { rankFormRecords, type FormRecord } from "@/lib/form-ranker";
import {
  medicationIdentityBadges,
  medicationIndication,
  rankMedicationRecords,
  type MedicationRecord,
} from "@/lib/medications";
import { extractKeywordTerms } from "@/lib/keyword-query";
import { rankServiceRecords, type ServiceRecord } from "@/lib/service-ranker";
import { universalSearchDomains, type UniversalSearchDomain } from "@/lib/universal-search-domains";
import { universalSearchModeForDomain } from "@/lib/universal-search-mode-context";
// Type-only, and it must stay that way: `universal-search.ts` reaches snapshot
// catalogues, rag and supabase, so a value import would pull the server module
// into the dashboard bundle. `use-universal-search.ts` carries the same note.
import type { UniversalSearchGroup } from "@/lib/universal-search";

/**
 * The modes a library line can point at.
 *
 * The first four are resolved from catalogues already in the browser. The rest
 * are reachable only through `/api/search/universal`, and only on a surface that
 * opts into that lookup — see `buildCrossModeLinksFromUniversalSearch`.
 *
 * Calculators, Factsheets, Sources, On Call and Favourites are absent on
 * purpose: they contribute no cross-entity search domain at all
 * (`universal-search-mode-context.ts`), so nothing can resolve a link to them.
 */
export type CrossModeLinkModeId = Extract<
  AppModeId,
  | "prescribing"
  | "services"
  | "forms"
  | "differentials"
  | "dsm"
  | "formulation"
  | "specifiers"
  | "therapy-compass"
  | "dictionary"
  | "tools"
>;

export type CrossModeLinkBadge = {
  label: string;
  tone?: "clinical" | "success" | "danger" | "warning" | "neutral" | "info";
};

export type CrossModeLink = {
  modeId: CrossModeLinkModeId;
  modeLabel: string;
  slug: string;
  title: string;
  subtitle: string;
  badges: CrossModeLinkBadge[];
  detailHref: string;
  modeSearchHref: string;
  modeSearchQuery: string;
  score: number;
  matchReason: string;
};

export type CrossModeDifferentialCatalog = {
  diagnoses: Array<{ slug: string; title: string; clinicalHinge: string }>;
  presentations: Array<{ id: string; title: string; subtitle: string; titleAliases?: string[] }>;
  aliases: Record<string, string[]>;
};

// The differential catalog is injected (not imported) so this module never
// statically pulls the 1.2 MB differentials snapshot — or the 3.4 MB
// medications snapshot — into the dashboard bundle.
export type CrossModeCatalogs = {
  medications?: MedicationRecord[];
  services?: ServiceRecord[];
  forms?: FormRecord[];
  differentials?: CrossModeDifferentialCatalog;
};

export type CrossModeLinkOptions = {
  maxPerMode?: number;
  maxTotal?: number;
};

// The gate for every mode is "the query names the entity" (a name/title-level
// match), not raw score: question filler like "dose" or "patient" survives
// keyword extraction and content-matches nearly every record for ~2 points per
// term, so content-only scores can never be trusted on their own.
const MEDICATION_MIN_SCORE = 10; // one name-term hit: 8 (name) + 2 (content echo)
const SERVICE_MIN_SCORE = 8; // one title-term hit: 6 (title) + 2 (content echo)
const DIFFERENTIAL_TITLE_TERM_SCORE = 8;

const RANKER_CANDIDATE_LIMIT = 5;

// Locally resolved modes lead: their links come from name-match thresholds tuned
// against this repo's own catalogues, while the universal-search modes below are
// gated on one title term. Only a tiebreaker for equal scores.
const modePriority: Record<CrossModeLinkModeId, number> = {
  prescribing: 0,
  services: 1,
  forms: 2,
  differentials: 3,
  dsm: 4,
  formulation: 5,
  specifiers: 6,
  "therapy-compass": 7,
  dictionary: 8,
  tools: 9,
};

const crossModeLinkModeIds = new Set<string>(Object.keys(modePriority));

function isCrossModeLinkModeId(modeId: string): modeId is CrossModeLinkModeId {
  return crossModeLinkModeIds.has(modeId);
}

function crossModeLinkBase(modeId: CrossModeLinkModeId, title: string) {
  return {
    modeId,
    modeLabel: appModeDefinition(modeId).label,
    title,
    modeSearchHref: appModeHomeHref(modeId, { query: title, focus: true, run: true }),
    modeSearchQuery: title,
  };
}

function serviceChipBadges(record: ServiceRecord): CrossModeLinkBadge[] {
  const badges: CrossModeLinkBadge[] = [];
  for (const chip of record.statusChips ?? []) {
    const label = chip.label?.trim();
    if (!label) continue;
    badges.push({ label, tone: chip.tone ?? undefined });
    if (badges.length === 2) break;
  }
  return badges;
}

// The rankers match name/title terms by substring, which lets query words hide
// inside entity names ("renal" inside "adrenaline"). A term only counts as
// naming an entity when it aligns with a word boundary; prefixes are accepted
// for longer terms so plural/possessive drift still matches.
function hasWordBoundaryMatch(value: string, terms: string[]) {
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return terms.some((term) => words.some((word) => word === term || (term.length >= 5 && word.startsWith(term))));
}

function medicationLinks(query: string, terms: string[], records: MedicationRecord[]): CrossModeLink[] {
  return rankMedicationRecords(records, query, RANKER_CANDIDATE_LIMIT)
    .filter(
      (match) =>
        match.score >= MEDICATION_MIN_SCORE &&
        (match.reasons.includes("name") || match.reasons.includes("exact name")) &&
        hasWordBoundaryMatch(`${match.medication.name} ${match.medication.slug}`, terms),
    )
    .map((match) => ({
      ...crossModeLinkBase("prescribing", match.medication.name),
      slug: match.medication.slug,
      subtitle: medicationIndication(match.medication),
      badges: medicationIdentityBadges(match.medication).slice(0, 2),
      detailHref: `/medications/${match.medication.slug}`,
      score: match.score,
      matchReason: match.reasons.join(" · "),
    }));
}

function registryLinks(
  modeId: Extract<CrossModeLinkModeId, "services" | "forms">,
  query: string,
  terms: string[],
  records: ServiceRecord[],
): CrossModeLink[] {
  const ranker = modeId === "services" ? rankServiceRecords : rankFormRecords;
  return ranker(records, query, RANKER_CANDIDATE_LIMIT)
    .filter(
      (match) =>
        match.score >= SERVICE_MIN_SCORE &&
        match.reasons.includes("title") &&
        hasWordBoundaryMatch(`${match.service.title} ${match.service.slug}`, terms),
    )
    .map((match) => ({
      ...crossModeLinkBase(modeId, match.service.title),
      slug: match.service.slug,
      subtitle: match.service.subtitle?.trim() || match.service.route?.trim() || "",
      badges: serviceChipBadges(match.service),
      detailHref: `/${modeId}/${match.service.slug}`,
      score: match.score,
      matchReason: match.reasons.join(" · "),
    }));
}

function differentialTitleScore(title: string, terms: string[], aliasDerived: Set<string>) {
  // Word-boundary matching keeps substring junk out; a matching term must
  // also be at least 4 chars unless it came from a curated alias.
  const matches = terms.filter(
    (term) => (term.length >= 4 || aliasDerived.has(term)) && hasWordBoundaryMatch(title, [term]),
  );
  return matches.length * DIFFERENTIAL_TITLE_TERM_SCORE;
}

function differentialLinks(terms: string[], catalog: CrossModeDifferentialCatalog): CrossModeLink[] {
  if (terms.length === 0) return [];

  const aliasDerived = new Set<string>();
  const expanded = new Set(terms);
  for (const term of terms) {
    for (const alias of catalog.aliases[term] ?? []) {
      const normalizedAlias = alias.toLowerCase();
      if (!expanded.has(normalizedAlias)) aliasDerived.add(normalizedAlias);
      expanded.add(normalizedAlias);
    }
  }
  const expandedTerms = [...expanded];

  const candidates: CrossModeLink[] = [];
  for (const record of catalog.diagnoses) {
    const score = differentialTitleScore(record.title, expandedTerms, aliasDerived);
    if (score < DIFFERENTIAL_TITLE_TERM_SCORE) continue;
    candidates.push({
      ...crossModeLinkBase("differentials", record.title),
      slug: record.slug,
      subtitle: record.clinicalHinge,
      badges: [],
      detailHref: `/differentials/diagnoses/${record.slug}`,
      score,
      matchReason: "title",
    });
  }
  for (const presentation of catalog.presentations) {
    const score = differentialTitleScore(
      [presentation.title, ...(presentation.titleAliases ?? [])].join(" "),
      expandedTerms,
      aliasDerived,
    );
    if (score < DIFFERENTIAL_TITLE_TERM_SCORE) continue;
    candidates.push({
      ...crossModeLinkBase("differentials", presentation.title),
      slug: presentation.id,
      subtitle: presentation.subtitle,
      badges: [],
      detailHref: `/differentials/presentations/${presentation.id}`,
      score,
      matchReason: "title or alternate title",
    });
  }

  return candidates
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 1);
}

// Follow-ups often drop the entity name ("what about renal impairment?"), so
// an answer thread resolves links from its newest turn that names an entity —
// walking all the way back, not just one turn, keeps the entity's card alive
// through consecutive entity-free follow-ups. Queries are ordered oldest first.
export function buildCrossModeLinksForThread(
  queries: Array<string | null | undefined>,
  catalogs: CrossModeCatalogs,
  options: CrossModeLinkOptions = {},
): CrossModeLink[] {
  for (let index = queries.length - 1; index >= 0; index -= 1) {
    const query = queries[index]?.trim();
    if (!query) continue;
    const links = buildCrossModeLinks(query, catalogs, options);
    if (links.length > 0) return links;
  }
  return [];
}

export function buildCrossModeLinks(
  query: string,
  catalogs: CrossModeCatalogs,
  options: CrossModeLinkOptions = {},
): CrossModeLink[] {
  const maxPerMode = options.maxPerMode ?? 2;
  const maxTotal = options.maxTotal ?? 4;

  const terms = extractKeywordTerms(query);
  if (terms.length === 0) return [];
  const keywordQuery = terms.join(" ");

  const candidates = [
    ...medicationLinks(keywordQuery, terms, catalogs.medications ?? []),
    ...registryLinks("services", keywordQuery, terms, catalogs.services ?? []),
    ...registryLinks("forms", keywordQuery, terms, catalogs.forms ?? []),
    ...(catalogs.differentials ? differentialLinks(terms, catalogs.differentials) : []),
  ];

  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      modePriority[left.modeId] - modePriority[right.modeId] ||
      left.title.localeCompare(right.title),
  );

  const seenKeys = new Set<string>();
  // A slug shared between the services and forms registries is the same
  // record surfaced twice; keep only the higher-scoring occurrence.
  const seenRegistrySlugs = new Set<string>();
  const perModeCounts: Partial<Record<CrossModeLinkModeId, number>> = {};
  const links: CrossModeLink[] = [];

  for (const candidate of candidates) {
    if (links.length >= maxTotal) break;
    const key = `${candidate.modeId}:${candidate.slug}`;
    if (seenKeys.has(key)) continue;
    if (candidate.modeId === "services" || candidate.modeId === "forms") {
      if (seenRegistrySlugs.has(candidate.slug)) continue;
      seenRegistrySlugs.add(candidate.slug);
    }
    const modeCount = perModeCounts[candidate.modeId] ?? 0;
    if (modeCount >= maxPerMode) continue;
    seenKeys.add(key);
    perModeCounts[candidate.modeId] = modeCount + 1;
    links.push(candidate);
  }

  return links;
}

/**
 * The universal-search domains a library line may consume, and their complement.
 *
 * Only these six are read here. `documents` is left out because an answer already
 * cites its documents in the evidence rail and source drawer, and `medications`,
 * `services`, `forms`, `differentials` and `presentations` are left out because
 * the catalogue path above already resolves them with tuned name-match
 * thresholds. Deriving the exclusion list from this one array rather than writing
 * it out twice is what stops a future domain being read by both halves and
 * showing the same record on one line.
 */
export const crossModeUniversalDomains = [
  "dsm",
  "formulation",
  "specifiers",
  "therapies",
  "dictionary",
  "tools",
] as const satisfies readonly UniversalSearchDomain[];

export const crossModeUniversalExcludedDomains: readonly UniversalSearchDomain[] = universalSearchDomains.filter(
  (domain) => !(crossModeUniversalDomains as readonly UniversalSearchDomain[]).includes(domain),
);

// Same gate and the same weight as `differentialTitleScore`: a term only counts
// when it names the record at a word boundary, and only when it is long enough
// that question filler cannot carry it. Universal search returns items its own
// adapters already ranked, so this is a second, stricter filter on top of that —
// never a substitute for it.
const UNIVERSAL_TITLE_TERM_SCORE = 8;
const UNIVERSAL_MIN_TERM_LENGTH = 4;

/**
 * Cross-mode links for the domains the local catalogues cannot reach.
 *
 * Returns only the links to ADD to `options.existing`, already deduplicated
 * against it, so a caller concatenates rather than merges. An empty or errored
 * group contributes nothing: a failed lookup must leave the line exactly as the
 * catalogue path left it, never a guess.
 */
export function buildCrossModeLinksFromUniversalSearch(
  query: string,
  groups: readonly UniversalSearchGroup[],
  options: { existing?: readonly CrossModeLink[]; maxPerMode?: number; maxTotal?: number } = {},
): CrossModeLink[] {
  const maxPerMode = options.maxPerMode ?? 1;
  const maxTotal = options.maxTotal ?? 2;
  const terms = extractKeywordTerms(query).filter((term) => term.length >= UNIVERSAL_MIN_TERM_LENGTH);
  if (terms.length === 0 || maxTotal <= 0) return [];

  const allowedDomains = new Set<string>(crossModeUniversalDomains);
  // `rank` is the item's position in the group the server returned it in, kept
  // so the domain's own ranking survives this mapper. Within a domain that
  // ranking is the only trustworthy order: the term-count score below is a
  // filter, not a ranker, and it ties constantly (most matches hit exactly one
  // term). Falling through to alphabetical order there let an earlier title
  // displace the domain's actual top result, which `maxPerMode` of 1 then made
  // the only result. `item.score` is deliberately not used: the type says it is
  // comparable within a group only.
  const candidates: Array<{ link: CrossModeLink; rank: number }> = [];

  for (const group of groups) {
    if (group.error || !allowedDomains.has(group.kind)) continue;
    const modeId = universalSearchModeForDomain(group.kind);
    if (!isCrossModeLinkModeId(modeId)) continue;

    let rank = 0;
    for (const item of group.items) {
      rank += 1;
      const title = item.title?.trim();
      const detailHref = item.href?.trim();
      if (!title || !detailHref) continue;
      const matched = terms.filter((term) => hasWordBoundaryMatch(title, [term]));
      if (matched.length === 0) continue;
      const badge = item.badge?.trim();
      candidates.push({
        rank,
        link: {
          ...crossModeLinkBase(modeId, title),
          // `id` is the domain's own record id; the href is the fallback so a
          // domain that omits one cannot collapse two records onto one React key.
          slug: item.id?.trim() || detailHref,
          subtitle: item.subtitle?.trim() ?? "",
          badges: badge ? [{ label: badge }] : [],
          detailHref,
          score: matched.length * UNIVERSAL_TITLE_TERM_SCORE,
          matchReason: "title",
        },
      });
    }
  }

  // Equal score and equal mode priority means the same domain, so `rank` here is
  // always a within-domain comparison and never an incomparable cross-domain one.
  candidates.sort(
    (left, right) =>
      right.link.score - left.link.score ||
      modePriority[left.link.modeId] - modePriority[right.link.modeId] ||
      left.rank - right.rank ||
      left.link.title.localeCompare(right.link.title),
  );

  const existing = options.existing ?? [];
  const seenKeys = new Set(existing.map((link) => `${link.modeId}:${link.slug}`));
  const seenHrefs = new Set(existing.map((link) => link.detailHref));
  const perModeCounts: Partial<Record<CrossModeLinkModeId, number>> = {};
  const links: CrossModeLink[] = [];

  for (const { link: candidate } of candidates) {
    if (links.length >= maxTotal) break;
    const key = `${candidate.modeId}:${candidate.slug}`;
    if (seenKeys.has(key) || seenHrefs.has(candidate.detailHref)) continue;
    const modeCount = perModeCounts[candidate.modeId] ?? 0;
    if (modeCount >= maxPerMode) continue;
    seenKeys.add(key);
    seenHrefs.add(candidate.detailHref);
    perModeCounts[candidate.modeId] = modeCount + 1;
    links.push(candidate);
  }

  return links;
}
