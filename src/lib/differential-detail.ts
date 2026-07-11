import type { DifferentialSourceStatus, DifferentialValidationStatus } from "@/lib/differential-records";
import type { DifferentialRecord, DifferentialSection } from "@/lib/differential-snapshot";

/** Pure presentation helpers for the differential diagnosis detail page.
 *  Client-safe by design: type-only imports and no catalog/snapshot access —
 *  the generated snapshot JSON must never enter the client bundle. Anything
 *  that needs the full catalog is computed server-side and travels in
 *  DifferentialDetailContext. */

export const DETAIL_TAB_IDS = ["overview", "compare", "map", "related", "source"] as const;
export type DifferentialDetailTabId = (typeof DETAIL_TAB_IDS)[number];

export function isDetailTabId(value: string | null | undefined): value is DifferentialDetailTabId {
  return typeof value === "string" && (DETAIL_TAB_IDS as readonly string[]).includes(value);
}

export type DifferentialDetailContext = {
  /** related[].id values verified against the diagnosis catalog (safe to link). */
  knownRelatedSlugs: string[];
  /** Cleaned mimic/overlap item text -> diagnosis slug (exact title matches only). */
  overlapLinks: Record<string, string>;
  /** First presentation workflow that lists this diagnosis as a candidate. */
  comparePresentation: { slug: string; title: string } | null;
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

export type DifferentialSafetyFact = {
  id: "high-risk" | "onset" | "course" | "treatable" | "causes" | "tests" | "actions" | "related";
  label: string;
  value: string;
};

/** Clinically reviewed course facts, keyed by slug. Only records listed here
 *  show qualitative Onset/Course/Treatable facts — every other record falls
 *  back to counts derived from its own data, so the card never fabricates
 *  clinical attributes the snapshot does not carry. */
const curatedSafetyFacts: Record<string, DifferentialSafetyFact[]> = {
  delirium: [
    { id: "high-risk", label: "High risk", value: "Yes" },
    { id: "onset", label: "Onset", value: "Acute" },
    { id: "course", label: "Course", value: "Fluctuating" },
    { id: "treatable", label: "Treatable", value: "Often" },
  ],
};

export function resolveSafetyFacts(record: DifferentialRecord): DifferentialSafetyFact[] {
  const curated = curatedSafetyFacts[record.slug];
  if (curated) return curated;

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
  lines.push("", "Clinical decision support only. Review before use.");
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
