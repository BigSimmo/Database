import {
  documentLabelReviewStatus,
  documentLabelTier,
  normalizeDocumentLabelForStorage,
  reviewDocumentTagQuality,
} from "@/lib/document-tags";
import type { ClinicalDocument, DocumentLabel, DocumentLabelType } from "@/lib/types";

export type LabelGovernanceDocument = Pick<ClinicalDocument, "id" | "title" | "file_name" | "metadata" | "labels"> & {
  summary?: { summary?: string | null } | null;
};

export type GoldDocumentLabel = {
  label: string;
  label_type: DocumentLabelType;
  reason: string;
};

export type GoldDocumentLabelRule = {
  id: string;
  description: string;
  patterns: RegExp[];
  labels: GoldDocumentLabel[];
};

export const highValueGoldLabelRules: GoldDocumentLabelRule[] = [
  {
    id: "lithium",
    description: "Lithium prescribing, toxicity, and monitoring sources.",
    patterns: [/\blithium\b/i],
    labels: [
      { label: "lithium", label_type: "medication", reason: "High-risk medication label." },
      { label: "monitor", label_type: "clinical_action", reason: "Lithium sources usually require monitoring." },
      {
        label: "medication-instruction",
        label_type: "document_intent",
        reason: "Supports medication-specific use in RAG.",
      },
      {
        label: "contains-monitoring-schedule",
        label_type: "content_feature",
        reason: "Prioritises monitoring schedules and tables.",
      },
    ],
  },
  {
    id: "clozapine",
    description: "Clozapine prescribing, monitoring, and shared-care sources.",
    patterns: [/\bclozapine\b/i],
    labels: [
      { label: "clozapine", label_type: "medication", reason: "High-risk medication label." },
      { label: "monitor", label_type: "clinical_action", reason: "Clozapine requires active monitoring." },
      {
        label: "maintenance-treatment",
        label_type: "care_phase",
        reason: "Most clozapine sources support ongoing care.",
      },
      { label: "high-risk-medication", label_type: "risk", reason: "Clozapine is a high-risk medicine." },
      {
        label: "contains-monitoring-schedule",
        label_type: "content_feature",
        reason: "Prioritises FBC/ANC monitoring evidence.",
      },
    ],
  },
  {
    id: "ect",
    description: "Electroconvulsive therapy pathways, consent, and governance.",
    patterns: [/\b(?:ect|electroconvulsive)\b/i],
    labels: [
      { label: "electroconvulsive-therapy", label_type: "topic", reason: "Canonical ECT topic label." },
      { label: "refer", label_type: "clinical_action", reason: "ECT sources often guide referral or review." },
      {
        label: "legal-governance",
        label_type: "document_intent",
        reason: "ECT often has consent/governance criteria.",
      },
    ],
  },
  {
    id: "seclusion-restraint",
    description: "Seclusion, restraint, de-escalation, and restrictive-practice sources.",
    patterns: [/\b(?:seclusion|restraint|restrictive practice|de-escalat|deescalat)\b/i],
    labels: [
      {
        label: "de-escalate",
        label_type: "clinical_action",
        reason: "Restrictive-practice sources need action filtering.",
      },
      { label: "clinical-risk", label_type: "risk", reason: "Restrictive practice belongs in risk/governance search." },
      {
        label: "legal-governance",
        label_type: "document_intent",
        reason: "Restrictive practice has governance rules.",
      },
    ],
  },
  {
    id: "mental-health-act",
    description: "Mental Health Act, involuntary treatment, capacity, CTO, and legal criteria.",
    patterns: [/\b(?:mental health act|mha\b|involuntary|community treatment order|cto\b|capacity assessment)\b/i],
    labels: [
      { label: "mental-health-act", label_type: "topic", reason: "Canonical legal framework topic." },
      { label: "assess", label_type: "clinical_action", reason: "Legal criteria usually require assessment." },
      { label: "legal-governance", label_type: "document_intent", reason: "Legal sources should filter together." },
      { label: "contains-legal-criteria", label_type: "content_feature", reason: "Improves criteria/table retrieval." },
    ],
  },
  {
    id: "camhs",
    description: "CAMHS and child/adolescent mental health sources.",
    patterns: [
      /\b(?:camhs|child and adolescent mental health|youth mental health|youth crisis|paediatric consultation liaison|pcls)\b/i,
    ],
    labels: [
      {
        label: "child and adolescent mental health service",
        label_type: "site",
        reason: "Canonical CAMHS site label.",
      },
      { label: "youth", label_type: "population", reason: "Youth-specific source filtering." },
    ],
  },
  {
    id: "camhs-crisis",
    description: "Explicit CAMHS crisis, urgent assessment, and emergency liaison sources.",
    patterns: [
      /\b(?:camhs crisis|youth crisis|urgent camhs|camhs urgent|camhs emergency|pcls|paediatric consultation liaison)\b/i,
    ],
    labels: [
      { label: "crisis-response", label_type: "care_phase", reason: "Explicit crisis pathways need phase filtering." },
    ],
  },
  {
    id: "emergency-workflow",
    description: "Emergency, escalation, Code Black, transfer, and acute response sources.",
    patterns: [
      /\b(?:emergency department|code black|duress|acute response|rapid response|mental health patient management within the emergency)\b/i,
    ],
    labels: [
      { label: "escalate", label_type: "clinical_action", reason: "Emergency sources commonly define escalation." },
      { label: "acute-management", label_type: "care_phase", reason: "Emergency sources support acute management." },
      { label: "decision-support", label_type: "document_intent", reason: "Emergency pathways are decision support." },
    ],
  },
];

export const labelRelevanceChecks = [
  {
    id: "lithium-monitoring",
    query: "lithium monitoring",
    expectedLabels: [
      { label: "lithium", label_type: "medication" as const },
      { label: "monitor", label_type: "clinical_action" as const },
    ],
  },
  {
    id: "clozapine-monitoring",
    query: "clozapine monitoring",
    expectedLabels: [
      { label: "clozapine", label_type: "medication" as const },
      { label: "monitor", label_type: "clinical_action" as const },
    ],
  },
  {
    id: "ect-pathway",
    query: "ECT pathway",
    expectedLabels: [{ label: "electroconvulsive-therapy", label_type: "topic" as const }],
  },
  {
    id: "mental-health-act-criteria",
    query: "Mental Health Act criteria",
    expectedLabels: [{ label: "legal-governance", label_type: "document_intent" as const }],
  },
  {
    id: "camhs-crisis",
    query: "CAMHS crisis",
    expectedLabels: [
      { label: "youth", label_type: "population" as const },
      { label: "crisis-response", label_type: "care_phase" as const },
    ],
  },
] as const;

function metadataText(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  return Object.values(metadata as Record<string, unknown>)
    .filter((value) => typeof value === "string")
    .join(" ");
}

export function documentGovernanceText(document: LabelGovernanceDocument) {
  return [document.title, document.file_name, document.summary?.summary, metadataText(document.metadata)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function documentGoldLabelText(document: LabelGovernanceDocument) {
  return [document.title, document.file_name, document.summary?.summary, metadataText(document.metadata)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeGoldLabel(label: GoldDocumentLabel) {
  return normalizeDocumentLabelForStorage({
    label: label.label,
    label_type: label.label_type,
    confidence: 1,
    source: "generated",
  });
}

function labelKey(label: Pick<DocumentLabel, "label" | "label_type">) {
  const normalized = normalizeDocumentLabelForStorage({
    label: label.label,
    label_type: label.label_type,
    confidence: 1,
    source: "generated",
  });
  return normalized ? `${normalized.label_type}:${normalized.label}` : `${label.label_type}:${label.label}`;
}

export function goldLabelsForDocument(document: LabelGovernanceDocument) {
  const text = documentGoldLabelText(document);
  const labels: GoldDocumentLabel[] = [];
  for (const rule of highValueGoldLabelRules) {
    if (!rule.patterns.some((pattern) => pattern.test(text))) continue;
    labels.push(...rule.labels);
  }

  const seen = new Set<string>();
  return labels.filter((label) => {
    const normalized = normalizeGoldLabel(label);
    if (!normalized) return false;
    const key = `${normalized.label_type}:${normalized.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function missingGoldLabelsForDocument(document: LabelGovernanceDocument) {
  const existing = new Set(
    (document.labels ?? []).filter((label) => documentLabelReviewStatus(label) !== "hidden").map(labelKey),
  );
  return goldLabelsForDocument(document).filter((label) => {
    const normalized = normalizeGoldLabel(label);
    return normalized ? !existing.has(`${normalized.label_type}:${normalized.label}`) : false;
  });
}

export function buildLabelAnalytics(documents: LabelGovernanceDocument[]) {
  const labelCounts = new Map<string, { label: string; label_type: DocumentLabelType; count: number }>();
  const byType = new Map<DocumentLabelType, number>();
  const byTier = new Map<string, number>();
  let labelRows = 0;
  let manual = 0;
  let generated = 0;
  let hidden = 0;
  let approved = 0;
  let lowConfidence = 0;

  for (const document of documents) {
    for (const label of document.labels ?? []) {
      const normalized = normalizeDocumentLabelForStorage(label);
      if (!normalized) continue;
      const key = `${normalized.label_type}:${normalized.label}`;
      labelRows += 1;
      if (label.source === "manual") manual += 1;
      else generated += 1;
      if (documentLabelReviewStatus(label) === "hidden") hidden += 1;
      if (documentLabelReviewStatus(label) === "approved") approved += 1;
      if (normalized.confidence < 0.6 && label.source !== "manual") lowConfidence += 1;
      byType.set(normalized.label_type, (byType.get(normalized.label_type) ?? 0) + 1);
      const tier = documentLabelTier(normalized.label, normalized.label_type);
      byTier.set(tier, (byTier.get(tier) ?? 0) + 1);
      const current = labelCounts.get(key) ?? { label: normalized.label, label_type: normalized.label_type, count: 0 };
      current.count += 1;
      labelCounts.set(key, current);
    }
  }

  const missingGoldLabels = documents
    .map((document) => ({
      document_id: document.id,
      title: document.title,
      missing: missingGoldLabelsForDocument(document),
    }))
    .filter((item) => item.missing.length);

  const matchedGoldRules = new Set<string>();
  for (const document of documents) {
    const text = documentGoldLabelText(document);
    for (const rule of highValueGoldLabelRules) {
      if (rule.patterns.some((pattern) => pattern.test(text))) matchedGoldRules.add(rule.id);
    }
  }

  const qualityIssues = reviewDocumentTagQuality(documents);
  const blockingQualityIssues = qualityIssues.filter((issue) => issue.kind !== "overused");

  return {
    documents: documents.length,
    labelRows,
    manual,
    generated,
    hidden,
    approved,
    lowConfidence,
    byType: Object.fromEntries([...byType.entries()].sort()),
    byTier: Object.fromEntries([...byTier.entries()].sort()),
    topLabels: [...labelCounts.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 25),
    qualityIssues: qualityIssues.slice(0, 25),
    blockingQualityIssues: blockingQualityIssues.slice(0, 25),
    missingGoldLabels: missingGoldLabels.slice(0, 50),
    unusedGoldRuleIds: highValueGoldLabelRules.map((rule) => rule.id).filter((id) => !matchedGoldRules.has(id)),
  };
}

export function buildClinicalLabelQaSample(documents: LabelGovernanceDocument[], sampleSize = 100) {
  const sorted = [...documents].sort((a, b) => a.id.localeCompare(b.id));
  const step = Math.max(1, Math.floor(sorted.length / Math.max(1, sampleSize)));
  return sorted
    .filter((_, index) => index % step === 0)
    .slice(0, sampleSize)
    .map((document) => {
      const rows = (document.labels ?? [])
        .map((label) => {
          const normalized = normalizeDocumentLabelForStorage(label);
          if (!normalized) return null;
          return {
            label: normalized.label,
            label_type: normalized.label_type,
            tier: documentLabelTier(normalized.label, normalized.label_type),
            source: label.source,
            confidence: normalized.confidence,
            review_status: documentLabelReviewStatus(label),
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));

      return {
        document_id: document.id,
        title: document.title,
        visible_labels: rows.filter((row) => row.review_status !== "hidden" && row.tier !== "ranking").length,
        ranking_labels: rows.filter((row) => row.review_status !== "hidden" && row.tier === "ranking").length,
        hidden_labels: rows.filter((row) => row.review_status === "hidden").length,
        missing_gold_labels: missingGoldLabelsForDocument(document).map(
          (label) => `${label.label_type}:${label.label}`,
        ),
      };
    });
}

export function runLabelRelevanceChecks(documents: LabelGovernanceDocument[]) {
  return labelRelevanceChecks.map((check) => {
    const matchedDocuments = documents.filter((document) => {
      const keys = new Set((document.labels ?? []).map(labelKey));
      return check.expectedLabels.every((label) => keys.has(labelKey(label)));
    });
    return {
      id: check.id,
      query: check.query,
      expectedLabels: check.expectedLabels.map((label) => `${label.label_type}:${label.label}`),
      matchingDocumentCount: matchedDocuments.length,
      sampleTitles: matchedDocuments.slice(0, 5).map((document) => document.title),
      passed: matchedDocuments.length > 0,
    };
  });
}

export function buildDocumentLabelGovernanceReport(documents: LabelGovernanceDocument[], sampleSize = 100) {
  const analytics = buildLabelAnalytics(documents);
  const qaSample = buildClinicalLabelQaSample(documents, sampleSize);
  const relevanceChecks = runLabelRelevanceChecks(documents);
  return {
    analytics,
    qaSample,
    relevanceChecks,
    passed:
      analytics.blockingQualityIssues.length === 0 &&
      analytics.missingGoldLabels.length === 0 &&
      relevanceChecks.every((check) => check.passed),
  };
}
