// Badge derivation for the document viewer's high-yield summary card.
//
// Framework-free (mirrors medication-badges.ts): data in, ClinicalBadge-shaped
// items out. Two inputs feed the cluster — safety-relevant document labels
// (Risk / Medication / Clinical action) and phrases detected in the stored
// summary text itself ("narrow therapeutic index", "Schedule 8", …). Tone
// rules follow the badge governance in docs/clinical-badge-system-guide.md:
// danger is reserved for true contraindications; regulatory/caution signals
// (S8, high-risk, toxicity) are warnings.

import { buildSmartDocumentTags, type SmartDocumentTagGroup } from "@/lib/document-tags";
import { sortBySemanticTonePriority, type SemanticIconKey, type SemanticTone } from "@/lib/semantic-tone";
import type { DocumentLabel } from "@/lib/types";

export type DocumentSummaryBadge = {
  id: string;
  label: string;
  tone: SemanticTone;
  iconKey?: SemanticIconKey;
};

type DocumentLabelLike = Pick<DocumentLabel, "label" | "label_type" | "source" | "confidence" | "metadata">;

// Canonical tone for each smart-tag group. Shared with DocumentTagCloud so the
// tag chips and the summary badge cluster speak the same colour language.
export const documentTagGroupTone: Record<SmartDocumentTagGroup, SemanticTone> = {
  Risk: "warning",
  Medication: "clinical",
  "Clinical action": "clinical",
  Workflow: "info",
  Manual: "success",
  Site: "neutral",
  Topic: "neutral",
  Population: "neutral",
  Setting: "neutral",
  Service: "neutral",
  "Document type": "neutral",
  "Care phase": "neutral",
  "Document intent": "neutral",
  "Content feature": "neutral",
};

// Groups whose labels are important enough to promote into the badge cluster;
// the rest stay in the browse-by-tag cloud.
const badgeWorthyGroups = new Set<SmartDocumentTagGroup>(["Risk", "Medication", "Clinical action"]);

type SummaryPhraseRule = {
  id: string;
  pattern: RegExp;
  label: string;
  tone: SemanticTone;
  iconKey?: SemanticIconKey;
};

// Phrase catalogue over the stored summary text. Every rule here is also
// registered in SEMANTIC_FLAG_CATALOGUE (document domain) so the
// /reference/colour-coding legend stays complete.
const summaryPhraseRules: SummaryPhraseRule[] = [
  { id: "summary-contraindication", pattern: /contraindicat/i, label: "Contraindications", tone: "danger" },
  {
    id: "summary-narrow-therapeutic-index",
    pattern: /narrow therapeutic (?:index|window|range)/i,
    label: "Narrow therapeutic index",
    tone: "warning",
  },
  {
    id: "summary-high-risk-medication",
    pattern: /high[- ]?risk medication/i,
    label: "High-risk medication",
    tone: "warning",
  },
  {
    id: "summary-controlled-drug",
    pattern: /\bschedule\s*8\b|\bS8\b/i,
    label: "Schedule 8",
    tone: "warning",
    iconKey: "controlled",
  },
  { id: "summary-toxicity", pattern: /\btoxic(?:ity)?\b/i, label: "Toxicity risk", tone: "warning" },
  {
    id: "summary-escalation",
    pattern: /\b(?:escalat\w*|urgent(?:ly)? review\w*|emergency)\b/i,
    label: "Escalation criteria",
    tone: "warning",
  },
  {
    id: "summary-pregnancy",
    pattern: /\b(?:pregnan\w*|lactation|breastfeed\w*)\b/i,
    label: "Pregnancy & lactation",
    tone: "warning",
  },
  {
    id: "summary-monitoring",
    pattern: /\b(?:monitor(?:ing|ed)?|serum levels?|blood tests?|fbc|anc|ecg|qtc)\b/i,
    label: "Monitoring required",
    tone: "info",
  },
];

export function buildDocumentSummaryBadges({
  labels,
  summaryText,
  limit = 8,
}: {
  labels?: DocumentLabelLike[] | null;
  summaryText?: string | null;
  limit?: number;
}): DocumentSummaryBadge[] {
  const badges: DocumentSummaryBadge[] = [];
  const seenIds = new Set<string>();
  const seenLabels = new Set<string>();

  const push = (badge: DocumentSummaryBadge) => {
    const labelKey = badge.label.toLowerCase();
    if (seenIds.has(badge.id) || seenLabels.has(labelKey)) return;
    seenIds.add(badge.id);
    seenLabels.add(labelKey);
    badges.push(badge);
  };

  for (const tag of buildSmartDocumentTags(labels, { includeManualGroup: false })) {
    if (!badgeWorthyGroups.has(tag.group)) continue;
    push({ id: `label-${tag.key}`, label: tag.label, tone: documentTagGroupTone[tag.group] });
  }

  if (summaryText) {
    for (const rule of summaryPhraseRules) {
      if (!rule.pattern.test(summaryText)) continue;
      push({ id: rule.id, label: rule.label, tone: rule.tone, iconKey: rule.iconKey });
    }
  }

  return sortBySemanticTonePriority(badges).slice(0, Math.max(0, limit));
}
