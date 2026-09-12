import { z } from "zod";
import { safeRecord } from "@/lib/rag/rag-answer-text";
import type { AnswerSectionKind, AnswerSectionSupportLevel, SearchResult } from "@/lib/types";
import { adaptiveAnswerLimits, legacyAnswerLimits, answerWithinLimits } from "@/lib/rag/rag-answer-contract-limits";

const answerSectionKinds = [
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
  "visual_evidence",
  "quotes",
  "verification",
] as const satisfies readonly AnswerSectionKind[];

const answerSectionSupportLevels = [
  "direct",
  "partial",
  "nearby",
  "unsupported",
] as const satisfies readonly AnswerSectionSupportLevel[];

const answerJsonOutputSchema = {
  type: "object",
  description:
    "A source-grounded clinical answer generated only from retrieved document excerpts, with claims tied to retrieved evidence IDs.",
  additionalProperties: false,
  properties: {
    answer: {
      type: "string",
      description:
        "The first-layer response: a complete, direct clinical answer that can stand alone before structured supporting sections. The first sentence must directly answer the question in full prose.",
      maxLength: legacyAnswerLimits.lead,
    },
    grounded: {
      type: "boolean",
      description: "True only when the answer is directly supported by the retrieved excerpts.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low", "unsupported"],
      description: "Confidence based on source strength and citation support, not general model knowledge.",
    },
    answerSections: {
      type: "array",
      description:
        "Second-layer structured support. Add only distinct source-backed modules that improve scanability, such as actions, monitoring, medication/dose, thresholds, comparison, cautions, documentation, or source gaps.",
      maxItems: legacyAnswerLimits.sections,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string", description: "Short section heading.", maxLength: legacyAnswerLimits.heading },
          kind: {
            type: "string",
            enum: answerSectionKinds,
            description:
              "Clinical support module type. Use source_gap for unsupported areas; do not use provenance as content.",
          },
          supportLevel: {
            type: "string",
            enum: answerSectionSupportLevels,
            description: "How directly the cited chunks support this section.",
          },
          body: {
            type: "string",
            description:
              "Clinically useful section body grounded in the cited excerpts. Keep it concise, decision-oriented, and non-redundant with the answer. Do not include document codes, page labels, chunk IDs, or source metadata.",
            maxLength: legacyAnswerLimits.body,
          },
          citation_chunk_ids: {
            type: "array",
            description:
              "Required retrieved evidence IDs that directly support this section. Use only citation_chunk_id values supplied in the source block.",
            items: { type: "string" },
          },
        },
        required: ["heading", "kind", "supportLevel", "body", "citation_chunk_ids"],
      },
    },
    citations: {
      type: "array",
      description:
        "The strongest retrieved evidence IDs that directly support the answer. Use only citation_chunk_id values supplied in the source block.",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          chunk_id: { type: "string", description: "A valid citation_chunk_id from the supplied source block." },
        },
        required: ["chunk_id"],
      },
    },
    quoteCards: {
      type: "array",
      description: "Short exact quotes copied from supplied excerpts. Use an empty array if no exact quote is useful.",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          chunk_id: { type: "string", description: "A valid citation_chunk_id from the supplied source block." },
          quote: { type: "string", description: "A short exact quote from the cited source excerpt.", maxLength: 260 },
          section_heading: { type: ["string", "null"], description: "Source section heading when visible." },
        },
        required: ["chunk_id", "quote", "section_heading"],
      },
    },
    conflictsOrGaps: {
      type: "array",
      description: "Important gaps or conflicts found in the retrieved excerpts.",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["gap", "conflict"],
            description: "Whether this is missing support or conflicting support.",
          },
          message: { type: "string", description: "Plain-language gap or conflict statement." },
          source_chunk_ids: {
            type: "array",
            description: "Retrieved chunk IDs related to the gap or conflict.",
            items: { type: "string" },
          },
        },
        required: ["type", "message", "source_chunk_ids"],
      },
    },
  },
  required: ["answer", "grounded", "confidence", "answerSections", "citations", "quoteCards", "conflictsOrGaps"],
};

/** Answer json output schema for results. */
function schemaForResults<T extends { properties: unknown }>(results: SearchResult[], base: T): T {
  const chunkIds = Array.from(new Set(results.map((result) => result.id).filter(Boolean)));
  if (chunkIds.length === 0) return base;

  const schema = structuredClone(base);
  const chunkIdSchema = { type: "string", enum: chunkIds };
  const properties = safeRecord(schema.properties);
  const answerSectionProperties = safeRecord(safeRecord(safeRecord(properties.answerSections).items).properties);
  const citationProperties = safeRecord(safeRecord(safeRecord(properties.citations).items).properties);
  const quoteCardProperties = safeRecord(safeRecord(safeRecord(properties.quoteCards).items).properties);
  const gapProperties = safeRecord(safeRecord(safeRecord(properties.conflictsOrGaps).items).properties);
  const answerSectionCitationIds = safeRecord(answerSectionProperties.citation_chunk_ids);
  const gapSourceIds = safeRecord(gapProperties.source_chunk_ids);

  if (Object.keys(answerSectionCitationIds).length > 0) answerSectionCitationIds.items = chunkIdSchema;
  if (Object.keys(citationProperties).length > 0) citationProperties.chunk_id = chunkIdSchema;
  if (Object.keys(quoteCardProperties).length > 0) quoteCardProperties.chunk_id = chunkIdSchema;
  if (Object.keys(gapSourceIds).length > 0) gapSourceIds.items = chunkIdSchema;

  return schema;
}

const citationSchema = z.object({
  chunk_id: z.string(),
  document_id: z.string().optional(),
  title: z.string().optional(),
  file_name: z.string().optional(),
  page_number: z.number().nullable().optional(),
  chunk_index: z.number().optional(),
});

export const answerJsonSchema = z.object({
  answer: z.string().min(1).optional(),
  grounded: z.boolean().optional(),
  confidence: z.enum(["high", "medium", "low", "unsupported"]).optional(),
  answerSections: z
    .array(
      z.object({
        heading: z.string().min(1),
        kind: z.enum(answerSectionKinds).optional(),
        supportLevel: z.enum(answerSectionSupportLevels).optional(),
        body: z.string().min(1),
        citation_chunk_ids: z.array(z.string()).optional().default([]),
      }),
    )
    .optional()
    .default([]),
  citations: z.array(citationSchema).optional().default([]),
  quoteCards: z
    .array(
      citationSchema.extend({
        quote: z.string().min(1),
        section_heading: z.string().nullable().optional(),
      }),
    )
    .optional()
    .default([]),
  conflictsOrGaps: z
    .array(
      z.object({
        type: z.enum(["gap", "conflict"]).catch("gap"),
        message: z.string().min(1),
        source_chunk_ids: z.array(z.string()).optional(),
      }),
    )
    .optional()
    .default([]),
});

export function answerJsonOutputSchemaForResults(results: SearchResult[]) {
  return schemaForResults(results, answerJsonOutputSchema);
}

const adaptiveSectionKinds = [...answerSectionKinds, "source_conflict"] as const;
const adaptiveOutputSchema = structuredClone(answerJsonOutputSchema);
adaptiveOutputSchema.properties.answer.maxLength = adaptiveAnswerLimits.lead;
adaptiveOutputSchema.properties.answerSections.maxItems = adaptiveAnswerLimits.sections;
adaptiveOutputSchema.properties.answerSections.items.properties.heading.maxLength = adaptiveAnswerLimits.heading;
adaptiveOutputSchema.properties.answerSections.items.properties.body.maxLength = adaptiveAnswerLimits.body;
const adaptiveProperties = adaptiveOutputSchema.properties;
const adaptiveOrderedSchema = {
  ...adaptiveOutputSchema,
  description: `Approved supplied-evidence answer; answer plus section headings and bodies must total at most ${adaptiveAnswerLimits.total} characters.`,
  properties: {
    answer: adaptiveProperties.answer,
    grounded: adaptiveProperties.grounded,
    confidence: adaptiveProperties.confidence,
    citations: adaptiveProperties.citations,
    answerSections: {
      ...adaptiveProperties.answerSections,
      items: {
        ...adaptiveProperties.answerSections.items,
        properties: {
          ...adaptiveProperties.answerSections.items.properties,
          kind: { ...adaptiveProperties.answerSections.items.properties.kind, enum: adaptiveSectionKinds },
          body: {
            ...adaptiveProperties.answerSections.items.properties.body,
            description:
              "Supported explanation; source identity, jurisdiction, date and permitted role may be stated when relevant. Never disclose internal metadata.",
          },
        },
      },
    },
    quoteCards: adaptiveProperties.quoteCards,
    conflictsOrGaps: adaptiveProperties.conflictsOrGaps,
  },
};
export function adaptiveAnswerJsonOutputSchemaForResults(results: SearchResult[]) {
  // The citation binder changes only ID slots; preserve the actual adaptive order.
  return schemaForResults(results, adaptiveOrderedSchema);
}
export const adaptiveAnswerJsonSchema = answerJsonSchema
  .extend({
    answer: z.string().min(1).max(adaptiveAnswerLimits.lead),
    grounded: z.boolean(),
    confidence: z.enum(["high", "medium", "low", "unsupported"]),
    answerSections: z
      .array(
        z.object({
          heading: z.string().min(1).max(adaptiveAnswerLimits.heading),
          kind: z.enum(adaptiveSectionKinds),
          supportLevel: z.enum(answerSectionSupportLevels),
          body: z.string().min(1).max(adaptiveAnswerLimits.body),
          citation_chunk_ids: z.array(z.string()),
        }),
      )
      .max(adaptiveAnswerLimits.sections),
  })
  .refine((value) => answerWithinLimits(value, adaptiveAnswerLimits), "Adaptive answer exceeds total prose budget");
