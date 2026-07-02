import type { DocumentLabel, DocumentLabelType } from "@/lib/types";

export type SmartDocumentTagGroup =
  | "Site"
  | "Medication"
  | "Risk"
  | "Workflow"
  | "Topic"
  | "Population"
  | "Setting"
  | "Service"
  | "Document type"
  | "Clinical action"
  | "Care phase"
  | "Document intent"
  | "Content feature"
  | "Manual";

export type SmartDocumentTagTier = "primary" | "secondary" | "ranking";

export type SmartDocumentTag = {
  key: string;
  label: string;
  searchText: string;
  label_type: DocumentLabelType;
  group: SmartDocumentTagGroup;
  tier: SmartDocumentTagTier;
  source: DocumentLabel["source"];
  confidence: number;
  score: number;
  queryMatched: boolean;
};

export type SmartDocumentTagFacet = {
  key: string;
  label: string;
  searchText: string;
  group: SmartDocumentTagGroup;
  count: number;
};

export type SmartDocumentTagQualityIssueKind = "noisy" | "duplicate" | "low_confidence" | "overused";

export type SmartDocumentTagQualityIssue = {
  kind: SmartDocumentTagQualityIssueKind;
  label: string;
  canonicalLabel?: string;
  label_type?: DocumentLabelType;
  count: number;
  reason: string;
  examples: string[];
  documentTitles: string[];
};

export type NormalizedDocumentLabel = {
  label: string;
  label_type: DocumentLabelType;
  confidence: number;
};

type LabelCandidate = {
  label?: unknown;
  label_type?: unknown;
  confidence?: unknown;
  source?: unknown;
};

const labelTypes = new Set<DocumentLabelType>([
  "topic",
  "document_type",
  "medication",
  "risk",
  "site",
  "setting",
  "workflow",
  "population",
  "service",
  "clinical_action",
  "care_phase",
  "document_intent",
  "content_feature",
  "custom",
]);

const groupLabels: Record<DocumentLabelType, SmartDocumentTagGroup> = {
  site: "Site",
  medication: "Medication",
  risk: "Risk",
  workflow: "Workflow",
  topic: "Topic",
  population: "Population",
  setting: "Setting",
  service: "Service",
  document_type: "Document type",
  clinical_action: "Clinical action",
  care_phase: "Care phase",
  document_intent: "Document intent",
  content_feature: "Content feature",
  custom: "Topic",
};

const groupRank: Record<SmartDocumentTagGroup, number> = {
  Site: 1,
  Medication: 2,
  "Clinical action": 3,
  "Care phase": 4,
  Risk: 5,
  "Document intent": 6,
  Topic: 7,
  Service: 8,
  Setting: 9,
  Population: 10,
  Workflow: 11,
  "Content feature": 12,
  "Document type": 13,
  Manual: 14,
};

export const smartDocumentFacetGroups: SmartDocumentTagGroup[] = [
  "Site",
  "Medication",
  "Clinical action",
  "Care phase",
  "Document intent",
  "Risk",
  "Workflow",
  "Topic",
  "Service",
  "Setting",
  "Population",
  "Document type",
];

const acronymDisplay = new Map([
  ["akg", "AKG"],
  ["anc", "ANC"],
  ["bsl", "BSL"],
  ["cbt", "CBT"],
  ["covid", "COVID"],
  ["ctt", "CTT"],
  ["ct", "CT"],
  ["ed", "ED"],
  ["ect", "ECT"],
  ["fbc", "FBC"],
  ["gp", "GP"],
  ["hr", "HR"],
  ["honos", "HoNOS"],
  ["honosca", "HoNOSCA"],
  ["im", "IM"],
  ["iv", "IV"],
  ["lai", "LAI"],
  ["mh", "MH"],
  ["mhat", "MHAT"],
  ["mhoa", "MHOA"],
  ["mhsp", "MHSP"],
  ["nocc", "NOCC"],
  ["nsaids", "NSAIDs"],
  ["nmhs", "NMHS"],
  ["prn", "PRN"],
  ["rpbg", "RPBG"],
  ["qtc", "QTc"],
  ["rkpg", "RKPG"],
  ["smhs", "SMHS"],
  ["wcc", "WCC"],
]);

const siteShortLabels = new Map([
  ["armadale kalamunda group", "AKG"],
  ["bentley health service", "BHS"],
  ["bmj best practice", "BMJ"],
  ["child and adolescent mental health service", "CAMHS"],
  ["east metropolitan health service", "EMHS"],
  ["fiona stanley hospital", "FSH"],
  ["fremantle hospital", "FH"],
  ["graylands neuropsychiatric", "Graylands"],
  ["king edward memorial hospital", "KEMH"],
  ["north metropolitan health service", "NMHS"],
  ["peel health campus", "PHC"],
  ["rockingham peel group", "RKPG"],
  ["royal perth bentley group", "RPBG"],
  ["south metropolitan health service", "SMHS"],
  ["wa health", "WA Health"],
]);

const displayLabelOverrides = new Map([
  ["assessment_tool", "Assessment tool"],
  ["prescribing_aid", "Prescribing aid"],
  ["blood test monitoring", "Blood test monitoring"],
  ["community program for opioid pharmacotherapy", "CPOP"],
  ["electroconvulsive-therapy", "Electroconvulsive therapy"],
  ["substance use alcohol and drugs", "Substance use, alcohol and drugs"],
  ["aggression violence code black", "Aggression, violence and Code Black"],
  ["admission waitlist bed access", "Admission, waitlist and bed access"],
  ["transport transfer escort", "Transport, transfer and escort"],
  ["rights carers advocates", "Rights, carers and advocates"],
  ["consent capacity confidentiality", "Consent, capacity and confidentiality"],
  ["incident notification open disclosure", "Incident, notification and open disclosure"],
  ["psychosis schizophrenia", "Psychosis and schizophrenia"],
  ["depression mood disorders", "Depression and mood disorders"],
  ["bipolar mood episode", "Bipolar and mood episode"],
  ["anxiety trauma", "Anxiety and trauma"],
  ["cognitive impairment learning disability", "Cognitive impairment and learning disability"],
  ["shared care gp liaison", "Shared care and GP liaison"],
  ["care coordination case management", "Care coordination and case management"],
  ["mental state examination", "Mental state examination"],
  ["community treatment order", "Community treatment order"],
  ["substance withdrawal", "Substance withdrawal"],
  ["acute psychosis", "Acute psychosis"],
  ["mood episode", "Mood episode"],
  ["initial assessment", "Initial assessment"],
  ["acute management", "Acute management"],
  ["crisis response", "Crisis response"],
  ["ongoing management", "Ongoing management"],
  ["maintenance treatment", "Maintenance treatment"],
  ["discharge planning", "Discharge planning"],
  ["post discharge follow up", "Post-discharge follow-up"],
  ["clinical instruction", "Clinical instruction"],
  ["decision support", "Decision support"],
  ["patient information", "Patient information"],
  ["staff guidance", "Staff guidance"],
  ["legal governance", "Legal and governance"],
  ["operational process", "Operational process"],
  ["documentation requirement", "Documentation requirement"],
  ["medication instruction", "Medication instruction"],
  ["contains table", "Contains table"],
  ["contains flowchart", "Contains flowchart"],
  ["contains form", "Contains form"],
  ["contains dosage guidance", "Contains dosage guidance"],
  ["contains monitoring schedule", "Contains monitoring schedule"],
  ["contains referral criteria", "Contains referral criteria"],
  ["contains escalation criteria", "Contains escalation criteria"],
  ["contains legal criteria", "Contains legal criteria"],
  ["contains quick reference", "Contains quick reference"],
  ["de escalate", "De-escalate"],
  ["qtc monitoring", "QTc monitoring"],
  ["nocc outcome measures", "NOCC outcome measures"],
]);

const displayLowercaseWords = new Set(["and", "or", "of", "to", "for", "in", "on", "with", "from", "by"]);

const rankingOnlyLabels = new Set([
  "clinical risk",
  "mental health",
  "inpatient",
  "assessment",
  "monitoring",
  "physical health care",
  "admission waitlist bed access",
  "clinical",
  "non clinical",
  "admin",
  "assess",
  "refer",
  "review",
  "document",
  "clinical instruction",
  "documentation requirements",
]);

const validClinicalActionLabels = new Set([
  "assess",
  "prescribe",
  "administer",
  "monitor",
  "escalate",
  "refer",
  "admit",
  "discharge",
  "transfer",
  "observe",
  "document",
  "notify",
  "review",
  "de escalate",
]);

export const clinicalDocumentTagAliases = [
  { from: "a n c", to: "absolute neutrophil count" },
  { from: "absolute neutrophils", to: "absolute neutrophil count" },
  { from: "akg", to: "armadale kalamunda group" },
  { from: "clozapin", to: "clozapine" },
  { from: "clozapine monitering", to: "clozapine monitoring" },
  { from: "ctt", to: "clinical treatment team" },
  { from: "depot", to: "long acting injectable medication" },
  { from: "depot medication", to: "long acting injectable medication" },
  { from: "emhs", to: "east metropolitan health service" },
  { from: "emhs policy", to: "east metropolitan health service" },
  { from: "f b c", to: "full blood count" },
  { from: "fh", to: "fiona stanley hospital" },
  { from: "fsh", to: "fiona stanley hospital" },
  { from: "haematological monitoring", to: "hematological monitoring" },
  { from: "honos", to: "honos rating scale" },
  { from: "ho nos", to: "honos rating scale" },
  { from: "honosca", to: "honosca rating scale" },
  { from: "lai", to: "long acting injectable medication" },
  { from: "lai antipsychotic", to: "long acting injectable antipsychotic" },
  { from: "lithum", to: "lithium" },
  { from: "long acting injection", to: "long acting injectable medication" },
  { from: "long acting injections", to: "long acting injectable medication" },
  { from: "long acting injectable", to: "long acting injectable medication" },
  { from: "long acting injectables", to: "long acting injectable medication" },
  { from: "long acting injectable depot medication", to: "long acting injectable medication" },
  { from: "mhat", to: "mental health assessment team" },
  { from: "mhoa", to: "mental health older adult service" },
  { from: "nocc", to: "nocc outcome measures" },
  { from: "qtc", to: "qtc monitoring" },
  { from: "rkpg", to: "rockingham peel group" },
  { from: "smhs", to: "south metropolitan health service" },
  { from: "smhs policy", to: "south metropolitan health service" },
  { from: "wcc", to: "white cell count" },
] as const;

const lowValueExact = new Set([
  "administration",
  "administrative",
  "all rights reserved",
  "authorisation",
  "clinical guideline",
  "copyright",
  "document",
  "document control",
  "document owner",
  "documents",
  "file",
  "guidance",
  "guideline",
  "page",
  "pdf",
  "policy",
  "procedure",
  "protocol",
  "publication",
  "reference",
  "references",
  "review",
  "source",
  "table",
  "uncontrolled when printed",
  "version",
  "workflow",
]);

const lowValuePattern =
  /\b(?:uncontrolled when printed|document owner|document control|version control|copyright|all rights reserved|authorisation date|publication date|review date)\b/i;

function normalizedText(value: string) {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/i, " ")
    .replace(/[_-]+/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9/+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyClinicalAliases(value: string) {
  const exact = clinicalDocumentTagAliases.find((alias) => alias.from === value);
  if (exact) return exact.to;

  let aliased = value;
  for (const alias of clinicalDocumentTagAliases) {
    if (alias.from.length < 4) continue;
    aliased = aliased.replace(new RegExp(`\\b${alias.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), alias.to);
  }
  return aliased.replace(/\s+/g, " ").trim();
}

function canonicalLabel(value: string, labelType: DocumentLabelType) {
  const normalized = applyClinicalAliases(normalizedText(value));
  if (!normalized) return "";

  if (labelType === "document_type") {
    if (normalized === "assessment tool" || normalized === "assessment tools") return "assessment_tool";
    if (normalized === "prescribing aid" || normalized === "medication chart") return "prescribing_aid";
    if (normalized === "standard operating procedure") return "procedure";
    if (normalized === "fact sheet" || normalized === "information sheet") return "factsheet";
    if (
      [
        "policy",
        "guideline",
        "procedure",
        "protocol",
        "form",
        "checklist",
        "pathway",
        "reference",
        "algorithm",
        "factsheet",
        "manual",
      ].includes(normalized)
    ) {
      return normalized;
    }
  }

  if (labelType === "topic" && (normalized === "ect" || normalized === "electroconvulsive therapy")) {
    return "electroconvulsive-therapy";
  }
  if (normalized === "long acting injectable" || normalized === "long acting injectables") {
    return "long acting injectable medication";
  }
  if (normalized === "depot" || normalized === "depot medication") return "long acting injectable medication";
  if (normalized === "risk and safety" || normalized === "safety risk") return "risk escalation";
  if (normalized === "escalation pathway") return "escalation pathway";
  if (normalized === "metabolic") return "metabolic monitoring";
  if (normalized === "blood test" || normalized === "blood tests") return "blood test monitoring";
  if (normalized === "dose" || normalized === "dosing") return "dose adjustment";
  if (normalized === "documentation" && labelType !== "document_type") return "documentation requirements";
  if (normalized === "form" || normalized === "forms") return "clinical form";
  if (normalized === "checklist") return "clinical checklist";
  if (normalized === "role" || normalized === "roles" || normalized === "responsibilities") {
    return "roles and responsibilities";
  }

  return normalized;
}

function usefulTokenCount(value: string) {
  return value.split(/\s+/).filter((token) => token.length > 2 || acronymDisplay.has(token)).length;
}

function isNoisyLabel(label: string, labelType: DocumentLabelType) {
  if (!label || label.length < 2 || label.length > 64) return true;
  if (lowValuePattern.test(label)) return true;
  if (/\b(?:docx?|xlsx?|pptx?|pdf)\b/.test(label)) return true;
  if (labelType === "clinical_action" && validClinicalActionLabels.has(label)) return false;
  if (
    labelType === "document_type" &&
    /^(?:policy|guideline|procedure|protocol|form|checklist|pathway|reference|algorithm|factsheet|manual|assessment_tool|prescribing_aid)$/.test(
      label,
    )
  ) {
    return false;
  }
  if (lowValueExact.has(label)) return true;
  if (usefulTokenCount(label) === 0) return true;
  if (label.split(/\s+/).length > 6) return true;
  if (labelType === "document_type" && ["clinical form", "clinical checklist"].includes(label)) return false;
  if (
    labelType === "site" &&
    /\b(?:hospital|health service|fiona stanley|rockingham peel|mental health service)\b/.test(label)
  ) {
    return false;
  }
  return false;
}

function confidenceValue(value: unknown) {
  const confidence = Number(value);
  return Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : 0.55;
}

function labelTypeValue(value: unknown): DocumentLabelType {
  return labelTypes.has(value as DocumentLabelType) ? (value as DocumentLabelType) : "custom";
}

function sourceValue(value: unknown): DocumentLabel["source"] {
  return value === "manual" ? "manual" : "generated";
}

export function formatDocumentLabelDisplay(value: string, labelType?: DocumentLabelType) {
  const displayValue = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (labelType === "site") {
    const siteShortLabel = siteShortLabels.get(displayValue);
    if (siteShortLabel) return siteShortLabel;
  }
  const override = displayLabelOverrides.get(value) ?? displayLabelOverrides.get(displayValue);
  if (override) return override;
  return displayValue
    .split(" ")
    .filter(Boolean)
    .map((word, index) => {
      const acronym = acronymDisplay.get(word);
      if (acronym) return acronym;
      if (index > 0 && displayLowercaseWords.has(word)) return word;
      return `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`;
    })
    .join(" ");
}

function displayLabel(value: string, labelType?: DocumentLabelType) {
  return formatDocumentLabelDisplay(value, labelType);
}

export function documentLabelTier(label: string, labelType: DocumentLabelType): SmartDocumentTagTier {
  const normalized = normalizedText(label);
  if (rankingOnlyLabels.has(normalized)) return "ranking";
  if (labelType === "site" || labelType === "medication" || labelType === "risk") return "primary";
  if (labelType === "clinical_action" || labelType === "care_phase" || labelType === "document_intent")
    return "primary";
  if (labelType === "topic" && !rankingOnlyLabels.has(normalized)) return "primary";
  return "secondary";
}

function queryTerms(query?: string) {
  return new Set(
    normalizedText(query ?? "")
      .split(/\s+/)
      .filter((term) => term.length >= 3),
  );
}

function queryMatches(label: string, terms: Set<string>) {
  if (terms.size === 0) return false;
  return [...terms].some((term) => label.includes(term));
}

function clinicalValueBoost(label: string, labelType: DocumentLabelType) {
  let boost = 0;
  if (labelType === "site") boost += 0.14;
  if (/\b(?:clozapine|lithium|antipsychotic|medication|dose|fbc|anc|qtc|ect|lai)\b/.test(label)) boost += 0.18;
  if (/\b(?:risk|escalation|safety|urgent|toxicity|suicide|violence|duress)\b/.test(label)) boost += 0.16;
  if (/\b(?:monitoring|threshold|pathway|workflow|admission|discharge|review|follow up)\b/.test(label)) boost += 0.12;
  if (
    /^(?:clinical risk|mental health|inpatient|assessment|monitoring|physical health care|admission waitlist bed access)$/.test(
      label.replace(/[_-]+/g, " "),
    )
  ) {
    boost -= 0.3;
  }
  if (labelType === "clinical_action" || labelType === "care_phase" || labelType === "document_intent") boost += 0.08;
  if (labelType === "content_feature") boost -= 0.02;
  if (labelType === "document_type") boost -= 0.08;
  if (labelType === "custom") boost -= 0.05;
  return boost;
}

export function normalizeDocumentLabelForStorage(candidate: LabelCandidate): NormalizedDocumentLabel | null {
  const labelType = labelTypeValue(candidate.label_type);
  const confidence = confidenceValue(candidate.confidence);
  const source = sourceValue(candidate.source);
  const canonical = canonicalLabel(String(candidate.label ?? ""), labelType);

  if (source !== "manual" && confidence < 0.5) return null;
  if (source !== "manual" && isNoisyLabel(canonical, labelType)) return null;
  if (!canonical) return null;

  return {
    label: canonical,
    label_type: labelType,
    confidence,
  };
}

export function buildSmartDocumentTags(
  labels: Array<Pick<DocumentLabel, "label" | "label_type" | "source" | "confidence">> | null | undefined,
  options: { limit?: number; query?: string; includeManualGroup?: boolean } = {},
) {
  const terms = queryTerms(options.query);
  const deduped = new Map<string, SmartDocumentTag>();

  for (const label of labels ?? []) {
    const normalized = normalizeDocumentLabelForStorage(label);
    const source = sourceValue(label.source);
    if (!normalized) continue;

    const group = options.includeManualGroup && source === "manual" ? "Manual" : groupLabels[normalized.label_type];
    const matched = queryMatches(normalized.label, terms);
    const score =
      (source === "manual" ? 1 : 0) +
      normalized.confidence +
      clinicalValueBoost(normalized.label, normalized.label_type) +
      (matched ? 1.5 : 0) -
      groupRank[group] * 0.04;
    const tag: SmartDocumentTag = {
      key: `${normalized.label_type}:${normalized.label}`,
      label: displayLabel(normalized.label, normalized.label_type),
      searchText: normalized.label,
      label_type: normalized.label_type,
      group,
      tier: documentLabelTier(normalized.label, normalized.label_type),
      source,
      confidence: normalized.confidence,
      score,
      queryMatched: matched,
    };
    const existing = deduped.get(tag.searchText);
    if (!existing || tag.score > existing.score) deduped.set(tag.searchText, tag);
  }

  const sorted = [...deduped.values()].sort(
    (a, b) =>
      Number(b.queryMatched) - Number(a.queryMatched) ||
      groupRank[a.group] - groupRank[b.group] ||
      b.score - a.score ||
      a.label.localeCompare(b.label),
  );

  return typeof options.limit === "number" ? sorted.slice(0, Math.max(0, options.limit)) : sorted;
}

export function groupSmartDocumentTags(
  labels: Array<Pick<DocumentLabel, "label" | "label_type" | "source" | "confidence">> | null | undefined,
  options: { limit?: number; query?: string; includeManualGroup?: boolean; includeRankingOnly?: boolean } = {},
) {
  const tags = buildSmartDocumentTags(labels, options).filter(
    (tag) => options.includeRankingOnly || tag.tier !== "ranking",
  );
  return [...new Set(tags.map((tag) => tag.group))]
    .sort((a, b) => groupRank[a] - groupRank[b])
    .map((group) => ({
      group,
      tags: tags.filter((tag) => tag.group === group),
    }));
}

export function tagSearchText(labels: ClinicalTagSource | null | undefined) {
  return buildSmartDocumentTags(labels?.labels)
    .map((tag) => `${tag.label} ${tag.searchText} ${tag.group}`)
    .join(" ");
}

function addQualityIssue(
  issues: SmartDocumentTagQualityIssue[],
  issue: Omit<SmartDocumentTagQualityIssue, "examples" | "documentTitles"> & {
    examples?: string[];
    documentTitles?: string[];
  },
) {
  issues.push({
    ...issue,
    examples: Array.from(new Set(issue.examples ?? [])).slice(0, 4),
    documentTitles: Array.from(new Set(issue.documentTitles ?? [])).slice(0, 4),
  });
}

export function reviewDocumentTagQuality<
  T extends ClinicalTagSource & { id?: string; title?: string; file_name?: string },
>(documents: T[], options: { lowConfidenceThreshold?: number; overusedThreshold?: number } = {}) {
  const lowConfidenceThreshold = options.lowConfidenceThreshold ?? 0.5;
  const overusedThreshold = options.overusedThreshold ?? Math.max(4, Math.ceil(documents.length * 0.25));
  const issues: SmartDocumentTagQualityIssue[] = [];
  const globalUsage = new Map<
    string,
    {
      label: string;
      canonicalLabel: string;
      label_type: DocumentLabelType;
      documents: Set<string>;
      examples: Set<string>;
    }
  >();

  for (const document of documents) {
    const title = document.title ?? document.file_name ?? document.id ?? "Untitled document";
    const perDocument = new Map<string, DocumentLabel[]>();

    for (const label of document.labels ?? []) {
      const confidence = confidenceValue(label.confidence);
      const canonical = normalizeDocumentLabelForStorage({
        label: label.label,
        label_type: label.label_type,
        confidence: 1,
        source: "generated",
      });
      if (!canonical) {
        addQualityIssue(issues, {
          kind: "noisy",
          label: String(label.label ?? ""),
          label_type: label.label_type,
          count: 1,
          reason: "Would be dropped by smart-tag cleanup.",
          examples: [String(label.label ?? "")],
          documentTitles: [title],
        });
        continue;
      }

      if (label.source !== "manual" && confidence < lowConfidenceThreshold) {
        addQualityIssue(issues, {
          kind: "low_confidence",
          label: displayLabel(canonical.label),
          canonicalLabel: canonical.label,
          label_type: canonical.label_type,
          count: 1,
          reason: `${Math.round(confidence * 100)}% confidence is below the ${Math.round(lowConfidenceThreshold * 100)}% threshold.`,
          examples: [String(label.label ?? "")],
          documentTitles: [title],
        });
      }

      const duplicateKey = `${canonical.label_type}:${canonical.label}`;
      perDocument.set(duplicateKey, [...(perDocument.get(duplicateKey) ?? []), label as DocumentLabel]);

      const global = globalUsage.get(duplicateKey) ?? {
        label: displayLabel(canonical.label),
        canonicalLabel: canonical.label,
        label_type: canonical.label_type,
        documents: new Set<string>(),
        examples: new Set<string>(),
      };
      global.documents.add(title);
      global.examples.add(String(label.label ?? ""));
      globalUsage.set(duplicateKey, global);
    }

    for (const [key, duplicates] of perDocument) {
      const uniqueRaw = new Set(duplicates.map((label) => normalizedText(String(label.label ?? ""))));
      if (duplicates.length < 2 || uniqueRaw.size < 2) continue;
      const [labelType, canonicalLabel] = key.split(":") as [DocumentLabelType, string];
      addQualityIssue(issues, {
        kind: "duplicate",
        label: displayLabel(canonicalLabel),
        canonicalLabel,
        label_type: labelType,
        count: duplicates.length,
        reason: "Multiple near-equivalent tags exist on the same document.",
        examples: duplicates.map((label) => label.label),
        documentTitles: [title],
      });
    }
  }

  for (const global of globalUsage.values()) {
    if (global.documents.size < overusedThreshold) continue;
    if (documentLabelTier(global.canonicalLabel, global.label_type) === "ranking") continue;
    addQualityIssue(issues, {
      kind: "overused",
      label: global.label,
      canonicalLabel: global.canonicalLabel,
      label_type: global.label_type,
      count: global.documents.size,
      reason: `Appears on ${global.documents.size} loaded documents; check whether it is too broad.`,
      examples: [...global.examples],
      documentTitles: [...global.documents],
    });
  }

  const rank: Record<SmartDocumentTagQualityIssueKind, number> = {
    noisy: 0,
    duplicate: 1,
    low_confidence: 2,
    overused: 3,
  };
  return issues.sort((a, b) => rank[a.kind] - rank[b.kind] || b.count - a.count || a.label.localeCompare(b.label));
}

export function buildSmartDocumentTagFacets<T extends ClinicalTagSource>(
  documents: T[],
  options: { query?: string; limitPerGroup?: number } = {},
) {
  const limitPerGroup = options.limitPerGroup ?? 8;
  const allowedGroups = new Set(smartDocumentFacetGroups);
  const facets = new Map<string, SmartDocumentTagFacet>();

  for (const document of documents) {
    const documentTagKeys = new Set<string>();
    const tags = buildSmartDocumentTags(document.labels, { query: options.query, includeManualGroup: false });
    for (const tag of tags) {
      if (tag.tier === "ranking") continue;
      if (!allowedGroups.has(tag.group) || documentTagKeys.has(tag.key)) continue;
      documentTagKeys.add(tag.key);
      const existing = facets.get(tag.key);
      if (existing) {
        existing.count += 1;
      } else {
        facets.set(tag.key, {
          key: tag.key,
          label: tag.label,
          searchText: tag.searchText,
          group: tag.group,
          count: 1,
        });
      }
    }
  }

  return smartDocumentFacetGroups
    .map((group) => ({
      group,
      facets: [...facets.values()]
        .filter((facet) => facet.group === group)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, Math.max(1, limitPerGroup)),
    }))
    .filter((group) => group.facets.length > 0);
}

export function filterDocumentsBySmartTagFacets<T extends ClinicalTagSource>(
  documents: T[],
  selectedTagKeys: string[],
) {
  if (selectedTagKeys.length === 0) return documents;
  const selected = new Set(selectedTagKeys);
  return documents.filter((document) => {
    const tagKeys = new Set(
      buildSmartDocumentTags(document.labels, { includeManualGroup: false }).map((tag) => tag.key),
    );
    return [...selected].every((key) => tagKeys.has(key));
  });
}

type ClinicalTagSource = {
  labels?: Array<Pick<DocumentLabel, "label" | "label_type" | "source" | "confidence">> | null;
};
