import type { DifferentialCuratedEntry } from "@/lib/differential-curated";
import type { DifferentialSourceStatus, DifferentialValidationStatus } from "@/lib/differential-records";
import type {
  DifferentialLikelihood,
  DifferentialMapNode,
  DifferentialRecord,
  DifferentialSection,
} from "@/lib/differential-snapshot";

/** Pure presentation helpers for the differential diagnosis detail page.
 *  Client-safe by design: type-only imports and no catalog/snapshot access —
 *  the generated snapshot JSON must never enter the client bundle. Anything
 *  that needs the full catalog is computed server-side and travels in
 *  DifferentialDetailContext. */

export const DETAIL_TAB_IDS = ["overview", "compare", "map", "related", "source"] as const;
export type DifferentialDetailTabId = (typeof DETAIL_TAB_IDS)[number];

export type DifferentialRelatedMapDetail = {
  slug: string;
  title: string;
  status: DifferentialRecord["status"];
  clinicalHinge: string;
  safetySummary: string;
};

export function isDetailTabId(value: string | null | undefined): value is DifferentialDetailTabId {
  return typeof value === "string" && (DETAIL_TAB_IDS as readonly string[]).includes(value);
}

export type DifferentialDetailContext = {
  /** related[].id values verified against the diagnosis catalog (safe to link). */
  knownRelatedSlugs: string[];
  /**
   * Small, server-derived summaries for verified related diagnoses. Keeping this
   * separate from `record.related` lets the map inspector show the selected
   * diagnosis's own hinge and safety content without shipping the full catalog
   * through the client boundary.
   */
  relatedMapDetails: Record<string, DifferentialRelatedMapDetail>;
  /**
   * Cleaned Watch-for tags + section item labels → diagnosis slug.
   * Exact catalog title or curated alias only (see differential-diagnosis-links).
   */
  termLinks: Record<string, string>;
  /**
   * Cleaned mimic/overlap item text → diagnosis slug.
   * Derived subset of `termLinks` for overlap-tone items (back-compat).
   */
  overlapLinks: Record<string, string>;
  /** First presentation workflow that lists this diagnosis as a candidate. */
  comparePresentation: { slug: string; title: string } | null;
  /**
   * This record's authored overlay entry, resolved server-side. Only the entry
   * for the record on screen crosses the boundary, so the authored prose of
   * every other record stays out of the client bundle.
   */
  curated: DifferentialCuratedEntry | null;
  source: {
    version: string;
    exportedAt: string;
    reviewStatus: string;
    sourceTitle: string;
    sourceStatus: DifferentialSourceStatus;
    validationStatus: DifferentialValidationStatus;
  };
};

/** Normalizes a generated snapshot item for display: collapses whitespace and
 *  strips the lone trailing full stop the export leaves on short fragments
 *  ("medication toxicity.") without touching real sentences or "e.g.". */
export function cleanDifferentialItem(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.endsWith(".") && collapsed.length <= 64 && !collapsed.slice(0, -1).includes(".")) {
    return collapsed.slice(0, -1).trimEnd();
  }
  return collapsed;
}

function comparableItemText(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/\.$/, "").toLowerCase();
}

/** Items actually worth rendering inside an expanded section. The generated
 *  export is noisy: `action`/`test` sections carry truncated copies of the
 *  record-level arrays (so prefer those), and many items duplicate the row
 *  summary or the record's clinical hinge. */
export function visibleSectionItems(section: DifferentialSection, record: DifferentialRecord): string[] {
  const source = section.tone === "test" && record.investigations.length > 0 ? record.investigations : section.items;
  const excluded = new Set([section.summary, record.clinicalHinge].map(comparableItemText).filter(Boolean));
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of source) {
    const cleaned = cleanDifferentialItem(raw);
    if (!cleaned) continue;
    const key = comparableItemText(cleaned);
    if (!key || excluded.has(key) || seen.has(key)) continue;
    seen.add(key);
    items.push(cleaned);
  }
  return items;
}

const sectionBadgeSuffix: Partial<Record<DifferentialSection["tone"], string>> = {
  fit: "present",
  warning: "possible",
  question: "positive",
  action: "pending",
};

/** Count badge text for a section row, using the cleaned item count so the
 *  badge always matches the expanded list; null when there is nothing to show. */
export function sectionBadgeLabel(section: DifferentialSection, record: DifferentialRecord): string | null {
  const count = visibleSectionItems(section, record).length;
  if (count === 0) return null;
  const suffix = sectionBadgeSuffix[section.tone];
  return suffix ? `${count} ${suffix}` : String(count);
}

export function differentialStatusLabel(status: DifferentialRecord["status"]): "Emergent" | "Urgent" | "Routine" {
  if (status === "emergent") return "Emergent";
  if (status === "urgent") return "Urgent";
  return "Routine";
}

/** Shown wherever authored content renders. Curated text is local clinical
 *  reference, not an extract from an indexed source, and must read that way.
 *  Declared here rather than beside the corpus so a client component can label
 *  authored content without importing every record's authored prose. */
export const curatedProvenanceLabel = "Locally authored \u2014 verify before use";

export type DifferentialSafetyFact = {
  id: "high-risk" | "onset" | "course" | "treatable" | "causes" | "tests" | "actions" | "related";
  label: string;
  value: string;
};

/** Clinically reviewed course facts now live in `differential-curated.ts` with
 *  the rest of the authored overlay. Only records listed there show qualitative
 *  Onset/Course/Treatable facts — every other record falls back to counts
 *  derived from its own data, so the card never fabricates clinical attributes
 *  the snapshot does not carry. */
export function resolveSafetyFacts(
  record: DifferentialRecord,
  curated: DifferentialCuratedEntry | null,
): DifferentialSafetyFact[] {
  const authored = curated?.atAGlance;
  if (authored?.length) return authored;

  const facts: DifferentialSafetyFact[] = [];
  const mustNotMiss = record.sections.find((section) => section.id === "must-not-miss");
  const causeCount = mustNotMiss ? visibleSectionItems(mustNotMiss, record).length : 0;
  if (causeCount > 0) facts.push({ id: "causes", label: "High-risk causes", value: String(causeCount) });
  if (record.investigations.length > 0) {
    facts.push({ id: "tests", label: "Core tests", value: String(record.investigations.length) });
  }
  if (record.immediateActions.length > 0) {
    facts.push({ id: "actions", label: "Immediate actions", value: String(record.immediateActions.length) });
  }
  if (record.related.length > 0) {
    facts.push({ id: "related", label: "Related differentials", value: String(record.related.length) });
  }
  return facts.slice(0, 4);
}

/** Compact phone labels for the Safety Snapshot metric strip. Longer labels
 *  wrap awkwardly in equal 3-column cells; the full label remains the
 *  accessible name via the fact's `label` field. */
export const safetyFactCompactLabel: Partial<Record<DifferentialSafetyFact["id"], string>> = {
  causes: "High-risk",
  tests: "Core tests",
  actions: "Actions",
  related: "Related",
  "high-risk": "High risk",
};

function normalizeSafetyToken(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]+$/g, "")
    .toLowerCase();
}

/** Split a summary or tag into comparable watch-for tokens (comma, slash, "and"). */
function splitSafetyTokens(value: string): string[] {
  return value
    .split(/\s*(?:,|\/|\band\b)\s*/i)
    .map(normalizeSafetyToken)
    .filter(Boolean);
}

/** True when every summary token is already covered by the Watch-for tags.
 *  Prefer tags in the card; keep the summary whenever it adds any unique risk
 *  token (tags being a subset of the summary must not hide those extras). */
export function isRedundantSafetySummary(summary: string, tags: readonly string[]): boolean {
  const summaryTokens = [...new Set(splitSafetyTokens(summary))];
  if (summaryTokens.length === 0) return true;

  const tagTokens = [...new Set(tags.flatMap((tag) => splitSafetyTokens(tag)))];
  if (tagTokens.length === 0) return false;

  const tagSet = new Set(tagTokens);
  return summaryTokens.every((token) => tagSet.has(token));
}

/** Deterministic plain-text register of the record for the "Copy after
 *  review" action: headline, hinge, safety summary, then actionable lists,
 *  ending with the on-page disclaimer. */
export function formatDifferentialCopyText(record: DifferentialRecord): string {
  const lines: string[] = [`${record.title} — ${differentialStatusLabel(record.status)} differential`];
  if (record.subtitle.trim()) lines.push(record.subtitle.trim());
  if (record.clinicalHinge.trim()) lines.push("", `Clinical hinge: ${record.clinicalHinge.trim()}`);
  if (record.safetySnapshot.summary.trim()) {
    lines.push("", `Must-not-miss: ${record.safetySnapshot.summary.trim()}`);
  }
  const actions = record.immediateActions.map(cleanDifferentialItem).filter(Boolean).slice(0, 6);
  if (actions.length > 0) {
    lines.push("", "Immediate actions:");
    for (const action of actions) lines.push(`- ${action}`);
  }
  const investigations = record.investigations.map(cleanDifferentialItem).filter(Boolean);
  if (investigations.length > 0) {
    lines.push("", "Investigations:");
    for (const investigation of investigations) lines.push(`- ${investigation}`);
  }
  lines.push("", "Clinical reference — not validated decision support. Review before use.");
  return lines.join("\n");
}

const clinicalHingePrefix = /^clinical hinge:\s*/i;

export type CurrentPresentationView =
  | { kind: "grouped"; groups: Array<{ title: string; candidates: string; hinge: string }> }
  | { kind: "flat"; items: Array<{ text: string; isHinge: boolean }> };

/** The generated currentPresentation list is usually a strict triplet stream
 *  (presentation title / candidate list / "CLINICAL HINGE: …") but many
 *  records deviate; fall back to a flat list with per-item hinge detection. */
export function groupCurrentPresentation(items: string[]): CurrentPresentationView {
  const cleaned = items.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  const isTripletStream =
    cleaned.length >= 3 &&
    cleaned.length % 3 === 0 &&
    cleaned.every((item, index) => clinicalHingePrefix.test(item) === (index % 3 === 2));
  if (isTripletStream) {
    const groups: Array<{ title: string; candidates: string; hinge: string }> = [];
    for (let index = 0; index < cleaned.length; index += 3) {
      groups.push({
        title: cleaned[index]!,
        candidates: cleaned[index + 1]!,
        hinge: cleaned[index + 2]!.replace(clinicalHingePrefix, ""),
      });
    }
    return { kind: "grouped", groups };
  }
  return {
    kind: "flat",
    items: cleaned.map((text) => ({
      text: text.replace(clinicalHingePrefix, ""),
      isHinge: clinicalHingePrefix.test(text),
    })),
  };
}

export function differentialSourceStatusLabel(status: DifferentialSourceStatus): string {
  if (status === "current") return "Current";
  if (status === "review_due") return "Review due";
  if (status === "outdated") return "Outdated";
  return "Unknown";
}

export function differentialValidationStatusLabel(status: DifferentialValidationStatus): string {
  if (status === "approved") return "Approved";
  if (status === "locally_reviewed") return "Locally reviewed";
  return "Unverified";
}

/** Date-only slice of the snapshot's exportedAt ISO stamp; avoids
 *  locale-dependent formatting that could mismatch between server and client. */
export function formatExportedDate(exportedAt: string): string {
  const match = exportedAt.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : exportedAt;
}

/** Trailing counts for the section rail. `null` means the tab carries no
 *  countable collection, so the rail renders the label alone rather than a
 *  misleading zero — Source is a governance panel, not a list of things. */
export function detailTabCounts(record: DifferentialRecord): Record<DifferentialDetailTabId, number | null> {
  return {
    // No count. "Overview 6" would be a tally of section rows, which is a fact
    // about the layout rather than about the patient — and the tab already
    // carries that number in its section-sheet detail line.
    overview: null,
    // The compare queue is this diagnosis plus everything it is compared against,
    // which is the number the Compare button has always shown.
    compare: record.related.length + 1,
    map: record.related.length + 1,
    related: record.related.length || null,
    source: null,
  };
}

/** Ordered first moves for the Overview rail. Curated steps where a record has
 *  them, otherwise the record's own immediate actions. Capped because a rail
 *  block that runs past the fold stops being a summary. */
export function resolveDoNowSteps(
  record: DifferentialRecord,
  curated: DifferentialCuratedEntry | null,
  limit = 4,
): string[] {
  const authored = curated?.doNow;
  const source = authored?.length ? authored : record.immediateActions;
  const seen = new Set<string>();
  const steps: string[] = [];
  for (const raw of source) {
    const cleaned = cleanDifferentialItem(raw);
    if (!cleaned) continue;
    const key = comparableItemText(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    steps.push(cleaned);
    if (steps.length >= limit) break;
  }
  return steps;
}

/** True when the record's own steps were replaced by authored ones, so the
 *  surface rendering them can say so. */
export function doNowStepsAreCurated(curated: DifferentialCuratedEntry | null): boolean {
  return (curated?.doNow?.length ?? 0) > 0;
}

export function curatedContentNote(curated: DifferentialCuratedEntry | null): string | null {
  return curated?.contentNote ?? null;
}

export function hasCuratedContent(curated: DifferentialCuratedEntry | null): boolean {
  if (!curated) return false;
  return Boolean(
    curated.atAGlance?.length || curated.doNow?.length || curated.discriminators?.length || curated.contentNote,
  );
}

/** One row of the map's "tell them apart" table. */
export type DifferentialDiscriminatorRow = {
  slug: string;
  label: string;
  likelihood: DifferentialLikelihood;
  /** Set only for a slug verified against the catalogue, so no row links nowhere. */
  href: string | null;
  favoursRelated: string;
  /** Null when the record carries nothing that distinguishes it from this one —
   *  an empty cell is honest, an echo of the other column is not. */
  favoursFocus: string | null;
  curated: boolean;
};

/**
 * Builds the comparison rows for the map panel.
 *
 * Authored discriminators win where a record has them. Otherwise the row is
 * derived from data the catalogue already carries: the related diagnosis's own
 * clinical hinge (server-supplied in `relatedMapDetails`, falling back to the
 * edge's relationship note) against this record's hinge. Nothing is invented,
 * so a sparse record produces a sparse table rather than a confident-looking
 * empty one.
 */
export function buildDiscriminators(
  record: DifferentialRecord,
  options: {
    knownRelatedSlugs: readonly string[];
    relatedMapDetails: Record<string, DifferentialRelatedMapDetail>;
    curated?: DifferentialCuratedEntry | null;
  },
): DifferentialDiscriminatorRow[] {
  const known = new Set(options.knownRelatedSlugs);
  const curated = new Map((options.curated?.discriminators ?? []).map((entry) => [entry.relatedSlug, entry]));
  const focusHinge = cleanDifferentialItem(record.clinicalHinge);

  return record.related.map((node: DifferentialMapNode) => {
    const authored = curated.get(node.id);
    const detail = options.relatedMapDetails[node.id];
    const derivedRelated = cleanDifferentialItem(detail?.clinicalHinge || node.note || "");
    const favoursRelated = authored ? authored.favoursRelated : derivedRelated;
    const favoursFocusRaw = authored ? authored.favoursFocus : focusHinge;
    const distinct =
      Boolean(favoursFocusRaw) && comparableItemText(favoursFocusRaw) !== comparableItemText(favoursRelated);

    return {
      slug: node.id,
      label: node.label,
      likelihood: node.likelihood,
      href: known.has(node.id) ? `/differentials/diagnoses/${node.id}` : null,
      favoursRelated,
      favoursFocus: distinct ? favoursFocusRaw : null,
      curated: Boolean(authored),
    };
  });
}
