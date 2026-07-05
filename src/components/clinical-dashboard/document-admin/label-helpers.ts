"use client";

import {
  documentLabelReviewStatus,
  documentLabelTier,
  formatDocumentLabelDisplay,
  normalizeDocumentLabelForStorage,
} from "@/lib/document-tags";
import type { DocumentLabel, DocumentLabelType } from "@/lib/types";
import type { SmartDocumentTagQualityIssueKind, SmartDocumentTagTier } from "@/lib/document-tags";
import { toneDanger, toneInfo, toneNeutral, toneSuccess, toneWarning } from "@/components/ui-primitives";

export const tagQualityTone: Record<SmartDocumentTagQualityIssueKind, string> = {
  noisy: toneDanger,
  duplicate: toneWarning,
  low_confidence: toneInfo,
  overused: toneNeutral,
};

export const labelTierTone: Record<SmartDocumentTagTier, string> = {
  primary: toneSuccess,
  secondary: toneNeutral,
  ranking: toneInfo,
};

export const documentLabelTypeOptions: Array<{ value: DocumentLabelType; label: string }> = [
  { value: "site", label: "Site" },
  { value: "topic", label: "Topic" },
  { value: "document_type", label: "Document type" },
  { value: "medication", label: "Medication" },
  { value: "risk", label: "Risk" },
  { value: "setting", label: "Setting" },
  { value: "workflow", label: "Workflow" },
  { value: "population", label: "Population" },
  { value: "service", label: "Service" },
  { value: "clinical_action", label: "Clinical action" },
  { value: "care_phase", label: "Care phase" },
  { value: "document_intent", label: "Document intent" },
  { value: "content_feature", label: "Content feature" },
  { value: "custom", label: "Manual" },
];

export function tagQualityLabel(kind: SmartDocumentTagQualityIssueKind) {
  if (kind === "low_confidence") return "low confidence";
  return kind;
}

export function normalizedLabelReviewRow(label: DocumentLabel) {
  const normalized = normalizeDocumentLabelForStorage(label);
  const fallbackLabelType = documentLabelTypeOptions.some((option) => option.value === label.label_type)
    ? label.label_type
    : "custom";
  const labelType = normalized?.label_type ?? fallbackLabelType;
  const labelText = normalized?.label ?? label.label?.trim() ?? "";
  const tier: SmartDocumentTagTier = normalized
    ? documentLabelTier(normalized.label, normalized.label_type)
    : "secondary";
  const reviewStatus = documentLabelReviewStatus(label);
  return {
    id: label.id,
    label: labelText,
    displayLabel: labelText ? formatDocumentLabelDisplay(labelText, labelType) : "Unreviewed label",
    labelType,
    tier,
    reviewStatus,
    source: label.source,
    confidence: normalized?.confidence ?? label.confidence ?? 0,
  };
}

export function labelTypeDisplay(value: DocumentLabelType) {
  return documentLabelTypeOptions.find((option) => option.value === value)?.label ?? value.replaceAll("_", " ");
}

export type LabelReviewMutationBody =
  { labelId: string; action: "approve" | "hide" | "restore" } | { label: string; label_type: DocumentLabelType };
