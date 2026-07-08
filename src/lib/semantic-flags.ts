// Site-wide semantic flag catalogue — the machine-readable single source of
// truth for "what colour flags what, per content piece".
//
// docs/clinical-badge-system-guide.md holds the prose governance; this module
// encodes the same rules as data so they can be rendered into the in-app legend
// (`/reference/colour-coding`) and validated by tests. When you add a new badge
// to a content area, add its flag here so the reference stays complete.

import type { SemanticIconKey, SemanticTone } from "@/lib/semantic-tone";

export type ContentDomain = "medication" | "document" | "evidence" | "answer" | "differential" | "service" | "admin";

export type SemanticFlagDef = {
  /** Unique within the catalogue. */
  id: string;
  domain: ContentDomain;
  /** Example label as it appears on screen. */
  label: string;
  tone: SemanticTone;
  /** When this flag applies / what it tells the reader. */
  meaning: string;
  /** Specific icon override (otherwise danger/warning use their tone default). */
  iconKey?: SemanticIconKey;
};

export const CONTENT_DOMAIN_ORDER: readonly ContentDomain[] = [
  "medication",
  "document",
  "evidence",
  "answer",
  "differential",
  "service",
  "admin",
];

export const CONTENT_DOMAIN_META: Record<ContentDomain, { label: string; description: string }> = {
  medication: {
    label: "Medications",
    description: "Prescribing records: identity, dosing, access, safety, and contraindication flags.",
  },
  document: {
    label: "Documents & sources",
    description: "Indexed documents: site/type metadata, review state, and ingestion status.",
  },
  evidence: {
    label: "Evidence & retrieval",
    description: "How well a source supports an answer or a specific claim.",
  },
  answer: {
    label: "Answers",
    description: "Grounding and source-currency signals shown around generated answers.",
  },
  differential: {
    label: "Differentials",
    description: "Diagnostic likelihood and red-flag severity.",
  },
  service: {
    label: "Services",
    description: "Service directory availability and referral requirements.",
  },
  admin: {
    label: "Admin & ingestion",
    description: "Operational pipeline status. Kept visually distinct from clinical safety.",
  },
};

export const SEMANTIC_FLAG_CATALOGUE: SemanticFlagDef[] = [
  // Medications
  {
    id: "med-formulation",
    domain: "medication",
    label: "333 mg EC tablet",
    tone: "neutral",
    meaning: "Formulation / strength (reference metadata).",
  },
  { id: "med-brand", domain: "medication", label: "Campral", tone: "neutral", meaning: "Brand name." },
  { id: "med-pbs-item", domain: "medication", label: "8357W", tone: "neutral", meaning: "PBS item number." },
  {
    id: "med-pbs-streamlined",
    domain: "medication",
    label: "PBS streamlined",
    tone: "success",
    meaning: "Subsidised / available access status.",
  },
  {
    id: "med-reviewed",
    domain: "medication",
    label: "Reviewed",
    tone: "success",
    meaning: "Locally reviewed / source-backed record.",
  },
  {
    id: "med-dose-instruction",
    domain: "medication",
    label: "666 mg TID",
    tone: "clinical",
    meaning: "A dosing instruction to act on.",
  },
  {
    id: "med-admin-instruction",
    domain: "medication",
    label: "Take with food",
    tone: "clinical",
    meaning: "Administration instruction.",
  },
  {
    id: "med-dose-ceiling",
    domain: "medication",
    label: "Max 1,998 mg/day",
    tone: "neutral",
    meaning: "Reference ceiling (not itself an action).",
  },
  {
    id: "med-controlled",
    domain: "medication",
    label: "S8",
    tone: "warning",
    meaning: "Controlled drug (Schedule 8). Regulatory, not a clinical stop.",
    iconKey: "controlled",
  },
  {
    id: "med-dose-adjust",
    domain: "medication",
    label: "Reduce <60 kg",
    tone: "warning",
    meaning: "Dose adjustment for a patient factor.",
  },
  {
    id: "med-organ-caution",
    domain: "medication",
    label: "Renal adjustment",
    tone: "warning",
    meaning: "Renal/hepatic caution — check before prescribing.",
  },
  {
    id: "med-population",
    domain: "medication",
    label: "Avoid <18 years",
    tone: "warning",
    meaning: "Population not established / age caution.",
  },
  {
    id: "med-contraindication",
    domain: "medication",
    label: "Cr >120 avoid",
    tone: "danger",
    meaning: "Contraindication / do not use.",
  },

  // Documents & sources
  {
    id: "doc-site",
    domain: "document",
    label: "Site: RPA",
    tone: "info",
    meaning: "Hospital / service site metadata.",
  },
  { id: "doc-type", domain: "document", label: "Guideline", tone: "neutral", meaning: "Document type." },
  {
    id: "doc-manual-override",
    domain: "document",
    label: "Manual override",
    tone: "info",
    meaning: "Organisation profile was manually curated.",
  },
  {
    id: "doc-needs-review",
    domain: "document",
    label: "Needs review",
    tone: "warning",
    meaning: "Profile / classification needs a human check.",
  },
  {
    id: "doc-ambiguous-site",
    domain: "document",
    label: "Ambiguous site",
    tone: "warning",
    meaning: "Multiple candidate sites — unresolved.",
  },
  { id: "doc-current", domain: "document", label: "Current", tone: "success", meaning: "Source is current / in date." },
  {
    id: "doc-review-due",
    domain: "document",
    label: "Review due",
    tone: "warning",
    meaning: "Source is due for review.",
  },
  {
    id: "doc-outdated",
    domain: "document",
    label: "Outdated",
    tone: "danger",
    meaning: "Source is out of date — do not rely on it.",
  },

  // Evidence & retrieval
  {
    id: "ev-strong",
    domain: "evidence",
    label: "Strong source",
    tone: "success",
    meaning: "Direct, strong source support.",
  },
  {
    id: "ev-source-backed",
    domain: "evidence",
    label: "Source-backed",
    tone: "success",
    meaning: "Claim is supported by a cited source.",
  },
  {
    id: "ev-partial",
    domain: "evidence",
    label: "Partial support",
    tone: "warning",
    meaning: "Only partially supported — interpret with caution.",
  },
  {
    id: "ev-nearby",
    domain: "evidence",
    label: "Nearby only",
    tone: "warning",
    meaning: "Related passage, not a direct answer.",
  },
  {
    id: "ev-no-support",
    domain: "evidence",
    label: "No direct support",
    tone: "danger",
    meaning: "No direct support where support is required.",
  },
  { id: "ev-page", domain: "evidence", label: "p.4", tone: "neutral", meaning: "Page / source locator metadata." },

  // Answers
  {
    id: "ans-direct",
    domain: "answer",
    label: "Source-backed",
    tone: "success",
    meaning: "Answer is directly source-backed.",
  },
  {
    id: "ans-source-current",
    domain: "answer",
    label: "Source current",
    tone: "success",
    meaning: "Cited source is current.",
  },
  {
    id: "ans-review-due",
    domain: "answer",
    label: "Source review due",
    tone: "warning",
    meaning: "Cited source is due for review.",
  },
  {
    id: "ans-outdated",
    domain: "answer",
    label: "Source outdated",
    tone: "danger",
    meaning: "Cited source is outdated.",
  },

  // Differentials
  {
    id: "dx-must-not-miss",
    domain: "differential",
    label: "Emergent",
    tone: "danger",
    meaning: "Must-not-miss / emergent diagnosis.",
  },
  {
    id: "dx-red-flag",
    domain: "differential",
    label: "Red flag",
    tone: "danger",
    meaning: "Red-flag feature — escalate.",
  },
  {
    id: "dx-urgent",
    domain: "differential",
    label: "Urgent",
    tone: "warning",
    meaning: "Urgent likelihood — act promptly.",
  },
  { id: "dx-routine", domain: "differential", label: "Routine", tone: "neutral", meaning: "Routine likelihood." },
  {
    id: "dx-key-feature",
    domain: "differential",
    label: "Key feature",
    tone: "success",
    meaning: "Supporting feature present.",
  },

  // Services
  {
    id: "svc-available",
    domain: "service",
    label: "Available",
    tone: "success",
    meaning: "Service is available / open.",
  },
  {
    id: "svc-referral",
    domain: "service",
    label: "Referral required",
    tone: "warning",
    meaning: "Access needs a referral / criteria.",
  },
  {
    id: "svc-metadata",
    domain: "service",
    label: "24/7",
    tone: "neutral",
    meaning: "Service metadata (hours, region, contact).",
  },

  // Admin & ingestion
  { id: "adm-queued", domain: "admin", label: "Queued", tone: "neutral", meaning: "Job queued." },
  { id: "adm-processing", domain: "admin", label: "Processing", tone: "info", meaning: "Job in progress." },
  { id: "adm-completed", domain: "admin", label: "Indexed", tone: "success", meaning: "Completed / indexed." },
  {
    id: "adm-needs-review",
    domain: "admin",
    label: "Needs review",
    tone: "warning",
    meaning: "Low confidence / needs review.",
  },
  { id: "adm-duplicate", domain: "admin", label: "Duplicate", tone: "warning", meaning: "Duplicate / noisy content." },
  { id: "adm-failed", domain: "admin", label: "Failed", tone: "danger", meaning: "Ingestion failed." },
];

export function flagsForDomain(domain: ContentDomain): SemanticFlagDef[] {
  return SEMANTIC_FLAG_CATALOGUE.filter((flag) => flag.domain === domain);
}
