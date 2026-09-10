import { ragAdaptiveAnswerPromptVersion } from "@/lib/rag/rag-versioning";
import { z } from "zod";
import { SOURCE_GOVERNANCE_CODES } from "@/lib/types";

// Public structured fields have a fixed depth and bounded collections. Objects
// strip unknown keys; malformed known fields fail the entire answer boundary.
const text = z.string().max(16_000);
const label = z.string().max(1_000);
const id = z.string().min(1).max(500);
const count = z.number().int().min(0).max(1_000_000);
const score = z.number().finite();
const ids = z.array(id).max(100);
const texts = z.array(text).max(100);
const pages = z.array(count).max(200);
const strength = z.enum(["strong", "moderate", "limited"]);

export const clientDocumentLabelSchema = z.object({
  label: z.string().min(1).max(500),
  label_type: z.enum([
    "site",
    "topic",
    "document_type",
    "medication",
    "risk",
    "setting",
    "workflow",
    "population",
    "service",
    "clinical_action",
    "care_phase",
    "document_intent",
    "content_feature",
    "custom",
  ]),
  source: z.enum(["generated", "manual"]),
  confidence: z.number().min(0).max(1),
});

export const clientAnswerSectionSchema = z.object({
  heading: label,
  body: text,
  citation_chunk_ids: ids,
  kind: z
    .enum([
      "bottom_line",
      "required_actions",
      "monitoring_timing",
      "medication_dose",
      "thresholds",
      "escalation_risk",
      "contraindications_cautions",
      "comparison",
      "documentation",
      "source_gap",
      "source_conflict",
      "visual_evidence",
      "quotes",
      "verification",
    ])
    .optional(),
  supportLevel: z.enum(["direct", "partial", "nearby", "unsupported"]).optional(),
});

const relevance = z.object({
  verdict: z.enum(["direct", "partial", "nearby", "none"]),
  label,
  matchedTerms: texts,
  missingTerms: texts,
  directSourceCount: count,
  weakSourceCount: count,
  score,
  supportReason: text,
  isSourceBacked: z.boolean(),
});

const relatedDocument = z.object({
  document_id: id,
  title: label,
  file_name: label,
  labels: z.array(clientDocumentLabelSchema).max(100),
  summary: text.nullable(),
  best_pages: pages,
  best_chunk_ids: ids,
  image_count: count,
  table_count: count.optional(),
  cover_image_id: id.nullable().optional(),
  match_reason: text,
  score,
});

const documentBreakdown = z.object({
  document_id: id,
  title: label,
  file_name: label,
  top_similarity: score,
  source_strength: strength,
  source_count: count,
  quote_count: count,
  pages,
  best_quote: text.optional(),
});

const visualEvidence = z.object({
  id,
  image_id: id,
  signed_url_endpoint: z.string().max(2_000),
  caption: text,
  document_id: id,
  title: label,
  file_name: label,
  page_number: count.nullable(),
  source_chunk_id: id,
  chunk_index: count,
  viewer_href: z.string().max(2_000),
  image_type: z
    .enum([
      "clinical_table",
      "flowchart_algorithm",
      "form_checklist",
      "risk_matrix",
      "medication_chart",
      "graph",
      "screenshot_ui",
      "cover_page",
      "photo",
      "logo_decorative",
      "unclear",
    ])
    .optional(),
  clinical_relevance_score: score.optional(),
  source_kind: label.nullable().optional(),
  tableLabel: label.nullable().optional(),
  tableTitle: label.nullable().optional(),
  tableRole: label.nullable().optional(),
  tableTextSnippet: text.nullable().optional(),
  clinicalUseClass: z
    .enum(["clinical_evidence", "administrative", "reference", "decorative_or_empty", "ambiguous"])
    .nullable()
    .optional(),
  clinicalUseReason: text.nullable().optional(),
  accessibleTableMarkdown: text.nullable().optional(),
  tableRows: z.array(z.array(label).max(50)).max(200).nullable().optional(),
  tableColumns: z.array(label).max(50).nullable().optional(),
  labels: texts.optional(),
});

export const clientAnswerFieldsSchema = z.object({
  claimMarks: z
    .array(
      z.object({
        claimId: id,
        text,
        supportStatus: z.enum(["direct", "partial"]),
        supportingChunkIds: ids,
      }),
    )
    .max(100)
    .optional(),
  sourceCurrencyWarning: z.enum(["supporting", "retrieved"]).optional(),
  answerContractVersion: z.literal(ragAdaptiveAnswerPromptVersion).optional(),
  renderAdaptiveAnswer: z.boolean().optional(),
  // Disclosure persists with the answer; feedback credentials deliberately do not.
  demoMode: z.boolean().optional(),
  fallbackMode: z.literal("non_production_demo").optional(),
  routingMode: z.enum(["unsupported", "extractive", "fast", "strong"]).optional(),
  providerMode: z.enum(["auto", "openai", "offline"]).optional(),
  answerQualityTier: z.enum(["model_synthesis", "source_only", "cached"]).optional(),
  queryClass: z
    .enum([
      "document_lookup",
      "table_threshold",
      "medication_dose_risk",
      "comparison",
      "broad_summary",
      "unsupported_or_general",
    ])
    .optional(),
  responseMode: z
    .enum(["checklist", "comparison_matrix", "threshold_table", "clinical_pathway", "document_lookup", "evidence_gap"])
    .optional(),
  comparisonMatrix: z
    .object({
      documents: z.array(z.object({ documentId: id, title: label, fileName: label })).max(100),
      rows: z
        .array(
          z.object({
            parameter: label,
            status: z.enum(["agreement", "conflict", "missing"]),
            entries: z
              .array(z.object({ documentId: id, chunkIds: ids, value: text.nullable(), qualifiers: texts }))
              .max(100),
          }),
        )
        .max(100),
    })
    .optional(),
  comparisonEvaluationState: z.enum(["evaluated", "not_evaluated"]).optional(),
  preformatted: z.boolean().optional(),
  answerSections: z.array(clientAnswerSectionSchema).max(100).optional(),
  evidenceSummary: z
    .object({
      document_count: count,
      total_sources: count,
      quote_count: count,
      image_count: count,
      source_strength: z.enum(["strong", "moderate", "limited", "none"]),
      summary: text,
    })
    .optional(),
  conflictsOrGaps: z
    .array(z.object({ type: z.enum(["gap", "conflict"]), message: text, source_chunk_ids: ids.optional() }))
    .max(100)
    .optional(),
  sourceCoverage: z
    .object({ documents_used: count, pages, strongest_similarity: score, has_images: z.boolean() })
    .optional(),
  visualEvidence: z.array(visualEvidence).max(100).optional(),
  documentBreakdown: z.array(documentBreakdown).max(100).optional(),
  relatedDocuments: z.array(relatedDocument).max(100).optional(),
  relevance: relevance.optional(),
  sourceGovernanceWarnings: z
    .array(
      z.object({
        code: z.enum(SOURCE_GOVERNANCE_CODES),
        severity: z.enum(["info", "warning", "danger"]),
        message: text,
        uiToken: z.enum(["destructive", "warning", "caution", "neutral", "muted"]).optional(),
        document_id: id.optional(),
        title: label.optional(),
      }),
    )
    .max(100)
    .optional(),
  truncated: z.boolean().optional(),
  truncationReason: text.optional(),
  unverifiedNumericTokens: texts.optional(),
  faithfulnessWarning: text.optional(),
});

export type ClientAnswerFields = z.infer<typeof clientAnswerFieldsSchema>;
export type ClientRelatedDocument = z.infer<typeof relatedDocument>;
