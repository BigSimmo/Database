import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { generateStructuredTextResponse } from "@/lib/openai";
import type {
  ClinicalDocument,
  DocumentLabel,
  DocumentLabelType,
  DocumentSummary,
  RelatedDocument,
  SearchResult,
} from "@/lib/types";

const labelTypes = new Set<DocumentLabelType>([
  "topic",
  "document_type",
  "medication",
  "risk",
  "setting",
  "workflow",
  "population",
  "service",
  "custom",
]);

const summarySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    clinical_specifics: {
      type: "object",
      additionalProperties: false,
      properties: {
        actions: { type: "array", items: { type: "string" } },
        thresholds_timing: { type: "array", items: { type: "string" } },
        medication_monitoring: { type: "array", items: { type: "string" } },
        risk_escalation: { type: "array", items: { type: "string" } },
        documentation_forms: { type: "array", items: { type: "string" } },
        exceptions_gaps: { type: "array", items: { type: "string" } },
      },
      required: [
        "actions",
        "thresholds_timing",
        "medication_monitoring",
        "risk_escalation",
        "documentation_forms",
        "exceptions_gaps",
      ],
    },
    labels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          label_type: {
            type: "string",
            enum: ["topic", "document_type", "medication", "risk", "setting", "workflow", "population", "service", "custom"],
          },
          confidence: { type: "number" },
        },
        required: ["label", "label_type", "confidence"],
      },
    },
  },
  required: ["summary", "clinical_specifics", "labels"],
};

type EnrichmentChunk = {
  id: string;
  page_number: number | null;
  chunk_index: number;
  section_heading: string | null;
  content: string;
};

type EnrichmentImage = {
  id: string;
  page_number: number | null;
  caption: string | null;
  image_type?: string | null;
  labels?: string[] | null;
};

type GeneratedLabel = {
  label: string;
  label_type: DocumentLabelType;
  confidence: number;
};

type GeneratedSummary = {
  summary: string;
  clinical_specifics: DocumentSummary["clinical_specifics"];
  labels: GeneratedLabel[];
};

function compactLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^\w\s/-]+/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function normalizeGeneratedLabels(labels: unknown): GeneratedLabel[] {
  if (!Array.isArray(labels)) return [];
  const seen = new Set<string>();
  const normalized: GeneratedLabel[] = [];

  for (const item of labels) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const label = compactLabel(String(raw.label ?? ""));
    const labelType = labelTypes.has(raw.label_type as DocumentLabelType)
      ? (raw.label_type as DocumentLabelType)
      : "custom";
    const confidence = Number(raw.confidence);
    const key = `${labelType}:${label}`;

    if (label.length < 2 || seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      label,
      label_type: labelType,
      confidence: Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : 0.55,
    });
    if (normalized.length >= 20) break;
  }

  return normalized;
}

function fallbackClinicalSpecifics(): DocumentSummary["clinical_specifics"] {
  return {
    actions: [],
    thresholds_timing: [],
    medication_monitoring: [],
    risk_escalation: [],
    documentation_forms: [],
    exceptions_gaps: ["No model-generated specifics were available; inspect the source passages."],
  };
}

function inferLabels(document: Pick<ClinicalDocument, "title" | "file_name" | "source_path">): GeneratedLabel[] {
  const haystack = `${document.title} ${document.file_name} ${document.source_path ?? ""}`.toLowerCase();
  const labels: GeneratedLabel[] = [];

  const add = (label: string, label_type: DocumentLabelType, confidence = 0.62) => {
    const normalized = compactLabel(label);
    if (!normalized || labels.some((item) => item.label === normalized && item.label_type === label_type)) return;
    labels.push({ label: normalized, label_type, confidence });
  };

  if (/clozapine/.test(haystack)) add("clozapine", "medication", 0.86);
  if (/ect|electroconvulsive/.test(haystack)) add("ect", "topic", 0.82);
  if (/metabolic/.test(haystack)) add("metabolic monitoring", "topic", 0.78);
  if (/risk|safety|duress|security/.test(haystack)) add("risk and safety", "risk", 0.72);
  if (/admission|discharge|leave|home visit|appointment/.test(haystack)) add("workflow", "workflow", 0.68);
  if (/prescri|medicat|injectable|neuroleptic/.test(haystack)) add("medication management", "topic", 0.72);
  if (/form|checklist|documentation|assessment/.test(haystack)) add("documentation", "document_type", 0.66);
  add("clinical guideline", "document_type", 0.55);

  return labels;
}

function trimChunk(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 1100);
}

function buildEnrichmentPrompt(args: {
  document: Pick<ClinicalDocument, "title" | "file_name" | "source_path">;
  chunks: EnrichmentChunk[];
  images: EnrichmentImage[];
}) {
  const sourceBlock = args.chunks
    .slice(0, 18)
    .map((chunk) => {
      const page = chunk.page_number ? `page ${chunk.page_number}` : "page unavailable";
      return [
        `chunk_id: ${chunk.id}`,
        `${page}; chunk ${chunk.chunk_index}; heading: ${chunk.section_heading ?? "none"}`,
        trimChunk(chunk.content),
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const imageBlock = args.images
    .slice(0, 12)
    .map((image) => {
      const labels = image.labels?.length ? ` labels=${image.labels.join(", ")}` : "";
      return `image_id: ${image.id}; page ${image.page_number ?? "n/a"}; type=${image.image_type ?? "unclear"};${labels} caption=${image.caption ?? ""}`;
    })
    .join("\n");

  return `Generate indexing-time enrichment for this uploaded clinical guideline/reference document.
Use only the provided source excerpts and image captions. Be ultra concise and high yield for clinical use.

Return strict JSON. Summary must be 3-6 compact bullets in one string. Clinical specifics arrays must contain only source-supported items and may be empty. Labels should be practical search labels.

Document: ${args.document.title}
File: ${args.document.file_name}
Source path: ${args.document.source_path ?? "unknown"}

Text excerpts:
${sourceBlock || "No source text available."}

Image evidence:
${imageBlock || "No indexed image evidence available."}`;
}

function parseGeneratedSummary(raw: string, document: Pick<ClinicalDocument, "title" | "file_name" | "source_path">) {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const specifics =
      parsed.clinical_specifics && typeof parsed.clinical_specifics === "object"
        ? (parsed.clinical_specifics as DocumentSummary["clinical_specifics"])
        : fallbackClinicalSpecifics();
    const summary = String(parsed.summary ?? "").trim();

    return {
      summary: summary || `- ${document.title}: indexed source text is available for source-backed review.`,
      clinical_specifics: {
        actions: Array.isArray(specifics.actions) ? specifics.actions.slice(0, 8) : [],
        thresholds_timing: Array.isArray(specifics.thresholds_timing) ? specifics.thresholds_timing.slice(0, 8) : [],
        medication_monitoring: Array.isArray(specifics.medication_monitoring)
          ? specifics.medication_monitoring.slice(0, 8)
          : [],
        risk_escalation: Array.isArray(specifics.risk_escalation) ? specifics.risk_escalation.slice(0, 8) : [],
        documentation_forms: Array.isArray(specifics.documentation_forms)
          ? specifics.documentation_forms.slice(0, 8)
          : [],
        exceptions_gaps: Array.isArray(specifics.exceptions_gaps) ? specifics.exceptions_gaps.slice(0, 8) : [],
      },
      labels: normalizeGeneratedLabels(parsed.labels),
    } satisfies GeneratedSummary;
  } catch {
    return {
      summary: `- ${document.title}: indexed source text is available for source-backed review.`,
      clinical_specifics: fallbackClinicalSpecifics(),
      labels: inferLabels(document),
    } satisfies GeneratedSummary;
  }
}

export async function generateDocumentEnrichment(args: {
  document: Pick<ClinicalDocument, "title" | "file_name" | "source_path">;
  chunks: EnrichmentChunk[];
  images?: EnrichmentImage[];
}) {
  const raw = await generateStructuredTextResponse(buildEnrichmentPrompt({ ...args, images: args.images ?? [] }), summarySchema, {
    model: env.OPENAI_FAST_ANSWER_MODEL,
    maxOutputTokens: 1000,
  });
  const parsed = parseGeneratedSummary(raw, args.document);
  const inferred = inferLabels(args.document);
  return {
    ...parsed,
    labels: normalizeGeneratedLabels([...parsed.labels, ...inferred]),
  };
}

export async function upsertDocumentEnrichment(args: {
  supabase: SupabaseClient;
  document: Pick<ClinicalDocument, "id" | "owner_id" | "title" | "file_name" | "source_path">;
  chunks: EnrichmentChunk[];
  images?: EnrichmentImage[];
}) {
  let enrichment: GeneratedSummary;
  try {
    enrichment = await generateDocumentEnrichment(args);
  } catch {
    enrichment = {
      summary: `- ${args.document.title}: indexed source text is available for source-backed review.`,
      clinical_specifics: fallbackClinicalSpecifics(),
      labels: inferLabels(args.document),
    };
  }

  const sourceChunkIds = args.chunks.slice(0, 12).map((chunk) => chunk.id);
  const sourceImageIds = (args.images ?? []).slice(0, 12).map((image) => image.id);

  const { data: summary, error: summaryError } = await args.supabase
    .from("document_summaries")
    .upsert(
      {
        document_id: args.document.id,
        owner_id: args.document.owner_id ?? null,
        summary: enrichment.summary,
        clinical_specifics: enrichment.clinical_specifics,
        source_chunk_ids: sourceChunkIds,
        source_image_ids: sourceImageIds,
        model: env.OPENAI_FAST_ANSWER_MODEL,
        metadata: { generated_by: "local-worker", label_count: enrichment.labels.length },
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "document_id" },
    )
    .select("*")
    .single();

  if (summaryError) throw new Error(summaryError.message);

  await args.supabase.from("document_labels").delete().eq("document_id", args.document.id).eq("source", "generated");
  if (enrichment.labels.length > 0) {
    const { error: labelsError } = await args.supabase.from("document_labels").insert(
      enrichment.labels.map((label) => ({
        document_id: args.document.id,
        owner_id: args.document.owner_id ?? null,
        ...label,
        source: "generated",
        metadata: { generated_by: "local-worker" },
      })),
    );
    if (labelsError) throw new Error(labelsError.message);
  }

  return { summary: summary as DocumentSummary, labels: enrichment.labels };
}

function tokenSet(text: string) {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((token) => token.length > 2),
  );
}

function compactSummary(summary?: string | null) {
  if (!summary) return null;
  const clean = summary.replace(/\s+/g, " ").replace(/^[-*]\s*/g, "").trim();
  return clean.length <= 220 ? clean : `${clean.slice(0, 217).trim()}...`;
}

type RelatedDocumentMetadataRow = {
  document_id: string;
  labels: DocumentLabel[] | null;
  summary: string | null;
};

async function fetchRelatedDocumentMetadata(args: {
  supabase: SupabaseClient;
  ownerId?: string;
  documentIds: string[];
}) {
  const { data: rpcData, error: rpcError } = await args.supabase.rpc("get_related_document_metadata", {
    document_ids: args.documentIds,
    owner_filter: args.ownerId ?? null,
  });

  if (!rpcError) {
    return ((rpcData ?? []) as RelatedDocumentMetadataRow[]).map((row) => ({
      document_id: row.document_id,
      labels: row.labels ?? [],
      summary: row.summary ?? null,
    }));
  }

  let labelsQuery = args.supabase
    .from("document_labels")
    .select("id,document_id,owner_id,label,label_type,source,confidence,metadata,created_at,updated_at")
    .in("document_id", args.documentIds);
  let summariesQuery = args.supabase
    .from("document_summaries")
    .select("document_id,owner_id,summary")
    .in("document_id", args.documentIds);

  if (args.ownerId) {
    labelsQuery = labelsQuery.eq("owner_id", args.ownerId);
    summariesQuery = summariesQuery.eq("owner_id", args.ownerId);
  }

  const [labelsResult, summariesResult] = await Promise.all([labelsQuery, summariesQuery]);
  const labels = (labelsResult.data ?? []) as DocumentLabel[];
  const summaries = (summariesResult.data ?? []) as Pick<DocumentSummary, "document_id" | "summary">[];
  const labelsByDocument = new Map<string, DocumentLabel[]>();
  const summariesByDocument = new Map<string, string | null>();

  for (const label of labels) {
    const existing = labelsByDocument.get(label.document_id) ?? [];
    existing.push(label);
    labelsByDocument.set(label.document_id, existing);
  }
  for (const summary of summaries) summariesByDocument.set(summary.document_id, summary.summary ?? null);

  return args.documentIds.map((documentId) => ({
    document_id: documentId,
    labels: labelsByDocument.get(documentId) ?? [],
    summary: summariesByDocument.get(documentId) ?? null,
  }));
}

export async function fetchRelatedDocuments(args: {
  supabase: SupabaseClient;
  ownerId?: string;
  query: string;
  results: SearchResult[];
  limit?: number;
}) {
  const grouped = new Map<
    string,
    {
      document_id: string;
      title: string;
      file_name: string;
      best_pages: number[];
      best_chunk_ids: string[];
      image_count: number;
      score: number;
    }
  >();

  for (const result of args.results) {
    const existing = grouped.get(result.document_id);
    const score = result.hybrid_score ?? result.similarity;
    const page = result.page_number ?? null;
    if (!existing) {
      grouped.set(result.document_id, {
        document_id: result.document_id,
        title: result.title,
        file_name: result.file_name,
        best_pages: page ? [page] : [],
        best_chunk_ids: [result.id],
        image_count: result.images?.filter((image) => image.searchable !== false).length ?? 0,
        score,
      });
      continue;
    }
    existing.score = Math.max(existing.score, score);
    if (page && !existing.best_pages.includes(page)) existing.best_pages.push(page);
    if (!existing.best_chunk_ids.includes(result.id)) existing.best_chunk_ids.push(result.id);
    existing.image_count += result.images?.filter((image) => image.searchable !== false).length ?? 0;
  }

  const documentIds = Array.from(grouped.keys());
  if (documentIds.length === 0) return [];

  const metadataRows = await fetchRelatedDocumentMetadata({
    supabase: args.supabase,
    ownerId: args.ownerId,
    documentIds,
  });
  const labelsByDocument = new Map<string, DocumentLabel[]>();
  const summariesByDocument = new Map<string, string | null>();

  for (const row of metadataRows) {
    labelsByDocument.set(row.document_id, row.labels);
    summariesByDocument.set(row.document_id, row.summary);
  }

  const queryTokens = tokenSet(args.query);

  return Array.from(grouped.values())
    .map((document) => {
      const docLabels = labelsByDocument.get(document.document_id) ?? [];
      const matchingLabel = docLabels.find((label) => queryTokens.has(label.label.toLowerCase()));
      const summary = summariesByDocument.get(document.document_id) ?? null;
      return {
        document_id: document.document_id,
        title: document.title,
        file_name: document.file_name,
        labels: docLabels.sort((a, b) => b.confidence - a.confidence).slice(0, 8),
        summary: compactSummary(summary),
        best_pages: document.best_pages.slice(0, 5),
        best_chunk_ids: document.best_chunk_ids.slice(0, 5),
        image_count: document.image_count,
        match_reason: matchingLabel
          ? `Matched label: ${matchingLabel.label}`
          : `Matched ${document.best_chunk_ids.length} indexed passage${document.best_chunk_ids.length === 1 ? "" : "s"}`,
        score: document.score,
      } satisfies RelatedDocument;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, args.limit ?? 6);
}
