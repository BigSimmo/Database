import OpenAI from "openai";
import { env, requireOpenAIEnv } from "@/lib/env";
import { assessClinicalImageUse } from "@/lib/image-filtering";
import { PublicApiError } from "@/lib/http";
import {
  deterministicStructuredVisualProfile,
  normalizeStructuredVisualProfile,
  type StructuredVisualProfile,
} from "@/lib/visual-intelligence";
import type { ImageEvidenceCategory, OpenAITokenUsage } from "@/lib/types";

type OpenAIOperation =
  | "embedding"
  | "answer"
  | "summary"
  | "vision_caption"
  | "vision_classification"
  | "text_generation";

type OpenAIReasoningEffort = "none" | "minimal" | "low" | "medium" | "high";
type OpenAITextVerbosity = "low" | "medium" | "high";
type OpenAIResponseInput = string | Array<Record<string, unknown>>;

type TextGenerationOptions = {
  model?: string;
  maxOutputTokens?: number;
  operation?: OpenAIOperation;
  promptCacheKey?: string;
  schemaName?: string;
  instructions?: string;
  reasoningEffort?: OpenAIReasoningEffort;
  textVerbosity?: OpenAITextVerbosity;
  timeoutMs?: number;
  maxRetries?: number;
};

type ResolvedTextGenerationOptions = Required<Pick<TextGenerationOptions, "model" | "maxOutputTokens">> &
  Omit<TextGenerationOptions, "model" | "maxOutputTokens">;

type APIPromiseLike<T> = Promise<T> & {
  withResponse?: () => Promise<{ data: T; response?: Response; request_id?: string | null }>;
};

export type OpenAITextResult = {
  text: string;
  model: string;
  operation: OpenAIOperation;
  latencyMs: number;
  requestId?: string | null;
  usage?: OpenAITokenUsage;
  /** Raw response status from the Responses API ("completed" | "incomplete" | …). */
  status?: string;
  /** True when the Responses API reported the output was cut off (e.g. max_output_tokens). */
  truncated?: boolean;
  /** Reason supplied in incomplete_details (e.g. "max_output_tokens", "content_filter"). */
  incompleteReason?: string;
};

let openAIClient: OpenAI | null = null;
const queryEmbeddingCache = new Map<string, number[]>();
const queryEmbeddingInflight = new Map<string, Promise<number[]>>();

export function createOpenAIClient() {
  try {
    requireOpenAIEnv();
  } catch {
    throw new PublicApiError("OpenAI is not configured. Add OPENAI_API_KEY and retry.", 500, {
      code: "openai_config",
    });
  }

  openAIClient ??= new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: env.OPENAI_REQUEST_TIMEOUT_MS,
    maxRetries: env.OPENAI_MAX_RETRIES,
  });
  return openAIClient;
}

function normalizeQueryEmbeddingText(text: string) {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function queryEmbeddingCacheKey(text: string) {
  return `${env.OPENAI_EMBEDDING_MODEL}\0${normalizeQueryEmbeddingText(text)}`;
}

function getCachedQueryEmbedding(text: string) {
  if (env.OPENAI_QUERY_CACHE_SIZE === 0) return null;

  const key = queryEmbeddingCacheKey(text);
  const cached = queryEmbeddingCache.get(key);
  if (!cached) return null;

  queryEmbeddingCache.delete(key);
  queryEmbeddingCache.set(key, cached);
  return cached;
}

function setCachedQueryEmbeddingByKey(key: string, embedding: number[]) {
  const limit = env.OPENAI_QUERY_CACHE_SIZE;
  if (limit === 0) return;

  if (queryEmbeddingCache.has(key)) queryEmbeddingCache.delete(key);
  queryEmbeddingCache.set(key, embedding);

  while (queryEmbeddingCache.size > limit) {
    const oldestKey = queryEmbeddingCache.keys().next().value;
    if (!oldestKey) break;
    queryEmbeddingCache.delete(oldestKey);
  }
}

function resolveTextGenerationOptions(
  options: string | TextGenerationOptions | undefined,
  fallbackModel: string,
): ResolvedTextGenerationOptions {
  if (typeof options === "string") {
    return {
      model: options,
      maxOutputTokens: env.OPENAI_MAX_OUTPUT_TOKENS,
    };
  }

  return {
    ...options,
    model: options?.model ?? fallbackModel,
    maxOutputTokens: options?.maxOutputTokens ?? env.OPENAI_MAX_OUTPUT_TOKENS,
  };
}

function requestOptions(options?: Pick<TextGenerationOptions, "timeoutMs" | "maxRetries">) {
  return {
    timeout: options?.timeoutMs ?? env.OPENAI_REQUEST_TIMEOUT_MS,
    maxRetries: options?.maxRetries ?? env.OPENAI_MAX_RETRIES,
  };
}

function promptCacheKeyFor(operation: OpenAIOperation) {
  switch (operation) {
    case "answer":
      return "clinical-rag-answer-v2";
    case "summary":
      return "clinical-document-summary-v1";
    case "vision_caption":
      return "clinical-image-caption-v1";
    case "vision_classification":
      return "clinical-image-classification-v1";
    case "embedding":
      return "clinical-embedding-v1";
    default:
      return "clinical-text-generation-v1";
  }
}

function defaultReasoningEffort(operation: OpenAIOperation, model: string): OpenAIReasoningEffort {
  if (!model.startsWith("gpt-5")) return "none";
  switch (operation) {
    case "answer":
      return model === env.OPENAI_STRONG_ANSWER_MODEL
        ? env.OPENAI_STRONG_REASONING_EFFORT
        : env.OPENAI_FAST_REASONING_EFFORT;
    case "summary":
      return env.OPENAI_SUMMARY_REASONING_EFFORT;
    case "vision_caption":
    case "vision_classification":
      return env.OPENAI_VISION_REASONING_EFFORT;
    default:
      return "none";
  }
}

function supportsReasoning(model: string) {
  return model.startsWith("gpt-5") || /^o\d/.test(model);
}

function supportsTextVerbosity(model: string) {
  return model.startsWith("gpt-5");
}

function responseBody(
  input: OpenAIResponseInput,
  resolved: ResolvedTextGenerationOptions,
  format?: Record<string, unknown>,
) {
  const operation = resolved.operation ?? "text_generation";
  const reasoningEffort = resolved.reasoningEffort ?? defaultReasoningEffort(operation, resolved.model);
  const textConfig: Record<string, unknown> = {};
  const promptCacheRetention =
    env.OPENAI_PROMPT_CACHE_RETENTION === "off" ? undefined : env.OPENAI_PROMPT_CACHE_RETENTION;

  if (format) textConfig.format = format;
  if (supportsTextVerbosity(resolved.model)) {
    textConfig.verbosity = resolved.textVerbosity ?? env.OPENAI_TEXT_VERBOSITY;
  }

  return {
    model: resolved.model,
    input,
    instructions: resolved.instructions,
    max_output_tokens: resolved.maxOutputTokens,
    store: env.OPENAI_STORE_RESPONSES,
    prompt_cache_key: resolved.promptCacheKey ?? promptCacheKeyFor(operation),
    prompt_cache_retention: promptCacheRetention,
    metadata: { operation },
    reasoning:
      supportsReasoning(resolved.model) && reasoningEffort !== "none" ? { effort: reasoningEffort } : undefined,
    text: Object.keys(textConfig).length > 0 ? textConfig : undefined,
  };
}

async function unwrapOpenAIResponse<T>(request: APIPromiseLike<T>) {
  if (typeof request.withResponse === "function") {
    return request.withResponse();
  }

  const data = await request;
  return { data, request_id: getRequestId(data) };
}

function extractOutputText(response: unknown) {
  const outputText = (response as { output_text?: unknown }).output_text;
  return typeof outputText === "string" ? outputText : "";
}

function extractCompletionStatus(response: unknown): {
  status?: string;
  truncated: boolean;
  incompleteReason?: string;
} {
  const value = response as {
    status?: unknown;
    incomplete_details?: { reason?: unknown } | null;
  };
  const status = typeof value.status === "string" ? value.status : undefined;
  const reasonRaw = value.incomplete_details?.reason;
  const incompleteReason = typeof reasonRaw === "string" ? reasonRaw : undefined;
  const truncated = status === "incomplete" || incompleteReason === "max_output_tokens";
  return { status, truncated, incompleteReason };
}

function extractUsage(response: unknown): OpenAITokenUsage | undefined {
  const usage = (response as { usage?: Record<string, unknown> }).usage;
  if (!usage) return undefined;

  const inputDetails = usage.input_tokens_details as Record<string, unknown> | undefined;
  const outputDetails = usage.output_tokens_details as Record<string, unknown> | undefined;
  return {
    input_tokens: typeof usage.input_tokens === "number" ? usage.input_tokens : undefined,
    output_tokens: typeof usage.output_tokens === "number" ? usage.output_tokens : undefined,
    total_tokens: typeof usage.total_tokens === "number" ? usage.total_tokens : undefined,
    cached_input_tokens: typeof inputDetails?.cached_tokens === "number" ? inputDetails.cached_tokens : undefined,
    reasoning_output_tokens:
      typeof outputDetails?.reasoning_tokens === "number" ? outputDetails.reasoning_tokens : undefined,
  };
}

function getRequestId(source: unknown) {
  const value = source as {
    request_id?: unknown;
    _request_id?: unknown;
    response?: { headers?: { get?: (name: string) => string | null } };
    headers?: { get?: (name: string) => string | null };
  };
  if (typeof value.request_id === "string") return value.request_id;
  if (typeof value._request_id === "string") return value._request_id;
  return value.response?.headers?.get?.("x-request-id") ?? value.headers?.get?.("x-request-id") ?? null;
}

function getErrorStatus(error: unknown) {
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function getErrorCode(error: unknown) {
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function isTimeoutError(error: unknown) {
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const code = getErrorCode(error)?.toLowerCase();
  return (
    code === "etimedout" ||
    code === "timeout" ||
    name.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("aborted")
  );
}

export function mapOpenAIError(error: unknown, operation: OpenAIOperation) {
  if (error instanceof PublicApiError) return error;

  const status = getErrorStatus(error);
  const code = getErrorCode(error) ?? "openai_request_failed";
  const requestId = getRequestId(error);

  if (isTimeoutError(error) || status === 408) {
    return new PublicApiError("OpenAI timed out. Trying source-only fallback response.", 504, {
      code,
      requestId,
    });
  }

  if (status === 401 || status === 403) {
    return new PublicApiError("OpenAI authentication failed. Check the server API key configuration.", 500, {
      code,
      requestId,
    });
  }

  if (status === 429 || code === "rate_limit_exceeded") {
    return new PublicApiError("OpenAI is rate limited. Retry in a moment.", 429, { code, requestId });
  }

  if (code.startsWith("invalid_image") || code === "image_too_large" || code === "unsupported_image_media_type") {
    return new PublicApiError(
      "OpenAI could not read one of the extracted images. Inspect the source file and retry.",
      502,
      {
        code,
        requestId,
      },
    );
  }

  if (status === 400) {
    return new PublicApiError("OpenAI rejected the request. Check the model, schema, and input configuration.", 502, {
      code,
      requestId,
    });
  }

  if (status && status >= 500) {
    return new PublicApiError("OpenAI service error. Retry shortly.", 502, { code, requestId });
  }

  return new PublicApiError(`OpenAI ${operation.replaceAll("_", " ")} request failed.`, 502, { code, requestId });
}

async function createTextResult(
  input: OpenAIResponseInput,
  options: ResolvedTextGenerationOptions,
  format?: Record<string, unknown>,
): Promise<OpenAITextResult> {
  const operation = options.operation ?? "text_generation";
  const startedAt = Date.now();

  try {
    const client = createOpenAIClient();
    const request = client.responses.create(responseBody(input, options, format) as never, requestOptions(options));
    const { data, request_id: requestId } = await unwrapOpenAIResponse(request as unknown as APIPromiseLike<unknown>);
    const completion = extractCompletionStatus(data);
    return {
      text: extractOutputText(data),
      model: options.model,
      operation,
      latencyMs: Date.now() - startedAt,
      requestId: requestId ?? getRequestId(data),
      usage: extractUsage(data),
      status: completion.status,
      truncated: completion.truncated,
      incompleteReason: completion.incompleteReason,
    };
  } catch (error) {
    throw mapOpenAIError(error, operation);
  }
}

export function clearOpenAICaches() {
  queryEmbeddingCache.clear();
  queryEmbeddingInflight.clear();
  openAIClient = null;
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) return [];

  const uniqueTexts: string[] = [];
  const uniqueIndexByText = new Map<string, number>();
  const outputIndexes = texts.map((text) => {
    const key = `${env.OPENAI_EMBEDDING_MODEL}\0${text}`;
    const cachedIndex = uniqueIndexByText.get(key);
    if (cachedIndex !== undefined) return cachedIndex;

    const nextIndex = uniqueTexts.length;
    uniqueTexts.push(text);
    uniqueIndexByText.set(key, nextIndex);
    return nextIndex;
  });

  try {
    const client = createOpenAIClient();
    const response = await client.embeddings.create(
      {
        model: env.OPENAI_EMBEDDING_MODEL,
        input: uniqueTexts,
        // IDX-C2: request the exact dimension the schema's vector(N) columns expect.
        dimensions: env.EMBEDDING_DIMENSIONS,
      },
      requestOptions(),
    );

    // IDX-C2: a short response means some inputs silently produced no embedding.
    if (response.data.length !== uniqueTexts.length) {
      throw new PublicApiError(
        `OpenAI returned ${response.data.length} embeddings for ${uniqueTexts.length} inputs.`,
        502,
        { code: "openai_embedding_count_mismatch" },
      );
    }

    // IDX-C1: the embeddings API does not guarantee response order; each item carries
    // an explicit `index` into the input array. Reassemble by that index so a chunk is
    // never stored with the embedding of an unrelated text (silent clinical corruption).
    const byIndex = new Array<number[]>(uniqueTexts.length);
    for (const item of response.data) {
      if (item.index < 0 || item.index >= uniqueTexts.length) {
        throw new PublicApiError(`OpenAI returned an out-of-range embedding index ${item.index}.`, 502, {
          code: "openai_embedding_index_range",
        });
      }
      // IDX-C2: guard against a model whose dimension does not match the schema.
      if (item.embedding.length !== env.EMBEDDING_DIMENSIONS) {
        throw new PublicApiError(
          `OpenAI embedding has ${item.embedding.length} dimensions; expected ${env.EMBEDDING_DIMENSIONS}. ` +
            `Check OPENAI_EMBEDDING_MODEL and EMBEDDING_DIMENSIONS match supabase/schema.sql.`,
          502,
          { code: "openai_embedding_dimension_mismatch" },
        );
      }
      byIndex[item.index] = item.embedding;
    }

    return outputIndexes.map((index) => byIndex[index]);
  } catch (error) {
    throw mapOpenAIError(error, "embedding");
  }
}

export async function embedText(text: string) {
  const { embedding } = await embedTextWithTelemetry(text);
  return embedding;
}

export async function embedTextWithTelemetry(text: string) {
  const cached = getCachedQueryEmbedding(text);
  if (cached) {
    return { embedding: cached, cacheHit: true };
  }

  const key = queryEmbeddingCacheKey(text);
  const inflight = queryEmbeddingInflight.get(key);
  if (inflight) {
    return { embedding: await inflight, cacheHit: true };
  }

  const embeddingPromise = embedTexts([text])
    .then((embeddings) => {
      const embedding = embeddings[0];
      if (!embedding) {
        throw new PublicApiError("OpenAI returned no embedding for the query.", 502, {
          code: "openai_empty_embedding",
        });
      }
      setCachedQueryEmbeddingByKey(key, embedding);
      return embedding;
    })
    .finally(() => {
      queryEmbeddingInflight.delete(key);
    });

  queryEmbeddingInflight.set(key, embeddingPromise);
  return { embedding: await embeddingPromise, cacheHit: false };
}

export async function generateTextResult(
  input: OpenAIResponseInput,
  options: string | TextGenerationOptions = env.OPENAI_ANSWER_MODEL,
) {
  const resolved = resolveTextGenerationOptions(options, env.OPENAI_ANSWER_MODEL);
  return createTextResult(input, resolved);
}

export async function generateTextResponse(
  input: OpenAIResponseInput,
  options: string | TextGenerationOptions = env.OPENAI_ANSWER_MODEL,
) {
  const result = await generateTextResult(input, options);
  return result.text;
}

export async function generateStructuredTextResult(
  input: OpenAIResponseInput,
  schema: Record<string, unknown>,
  options: string | TextGenerationOptions = env.OPENAI_ANSWER_MODEL,
) {
  const resolved = resolveTextGenerationOptions(options, env.OPENAI_ANSWER_MODEL);
  return createTextResult(input, resolved, {
    type: "json_schema",
    name: resolved.schemaName ?? "clinical_rag_answer",
    strict: true,
    schema,
  });
}

export async function generateStructuredTextResponse(
  input: OpenAIResponseInput,
  schema: Record<string, unknown>,
  options: string | TextGenerationOptions = env.OPENAI_ANSWER_MODEL,
) {
  const result = await generateStructuredTextResult(input, schema, options);
  return result.text;
}

const imageCaptionInstructions =
  "Generate a concise, clinically useful caption for an extracted guideline image. " +
  "Mention visible table or figure purpose, key labels, and any medication, risk, or monitoring details. " +
  "Do not infer patient-specific advice.";

export async function captionImageFromBase64(args: { base64: string; mimeType: string; nearbyText?: string }) {
  const input = [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: `Nearby text:\n${args.nearbyText ?? "not available"}`,
        },
        {
          type: "input_image",
          image_url: `data:${args.mimeType};base64,${args.base64}`,
          detail: "auto",
        },
      ],
    },
  ];
  const result = await generateTextResult(input, {
    model: env.OPENAI_VISION_MODEL,
    maxOutputTokens: 220,
    operation: "vision_caption",
    instructions: imageCaptionInstructions,
    reasoningEffort: env.OPENAI_VISION_REASONING_EFFORT,
  });

  return result.text.trim();
}

const imageCategories = new Set<ImageEvidenceCategory>([
  "clinical_table",
  "flowchart_algorithm",
  "form_checklist",
  "risk_matrix",
  "medication_chart",
  "graph",
  "screenshot_ui",
  "photo",
  "logo_decorative",
  "unclear",
]);

const imageClassificationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    image_type: {
      type: "string",
      enum: [...imageCategories],
      description: "The closest clinical evidence category for the extracted image.",
    },
    searchable: {
      type: "boolean",
      description: "False for decorative, empty, or non-clinical images that should not be surfaced as evidence.",
    },
    clinical_relevance_score: {
      type: "number",
      description: "Clinical usefulness from 0 to 1 based only on visible image content.",
    },
    labels: {
      type: "array",
      description: "Short search labels visible or strongly supported by the image.",
      items: { type: "string" },
    },
    caption: {
      type: "string",
      description: "Concise caption grounded in visible image content and nearby page text.",
    },
    skip_reason: {
      type: ["string", "null"],
      description: "Reason the image is not searchable, or null when searchable.",
    },
    clinical_use_class: {
      type: "string",
      enum: ["clinical_evidence", "administrative", "reference", "decorative_or_empty", "ambiguous"],
      description:
        "Whether this is useful clinical evidence, document administration, reference material, decorative/empty, or ambiguous.",
    },
    clinical_use_reason: {
      type: "string",
      description: "Short reason for the usefulness class based only on visible/extracted content.",
    },
    clinical_signal_score: {
      type: "number",
      description:
        "Count-like score from 0 to 10 for patient-care signals such as medication, monitoring, thresholds, risk, escalation, or workflow.",
    },
    admin_signal_score: {
      type: "number",
      description:
        "Count-like score from 0 to 10 for authorisation, version, amendment, site/applicability, reference, or document-control signals.",
    },
    structured_visual_profile: {
      type: "object",
      additionalProperties: false,
      properties: {
        clinical_purpose: { type: ["string", "null"] },
        key_terms: { type: "array", items: { type: "string" } },
        medications: { type: "array", items: { type: "string" } },
        thresholds: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              value: { type: ["string", "null"] },
              action: { type: ["string", "null"] },
              confidence: { type: "number" },
              source_text: { type: ["string", "null"] },
            },
            required: ["label", "value", "action", "confidence", "source_text"],
          },
        },
        actions: { type: "array", items: { type: "string" } },
        monitoring_items: { type: "array", items: { type: "string" } },
        flowchart_nodes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              type: { type: ["string", "null"] },
            },
            required: ["id", "label", "type"],
          },
        },
        flowchart_edges: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              label: { type: ["string", "null"] },
            },
            required: ["from", "to", "label"],
          },
        },
        risk_matrix_axes: { type: "array", items: { type: "string" } },
        risk_matrix_cells: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              row: { type: "string" },
              column: { type: "string" },
              risk: { type: "string" },
              action: { type: ["string", "null"] },
              confidence: { type: "number" },
            },
            required: ["row", "column", "risk", "action", "confidence"],
          },
        },
        chart_axes: { type: "array", items: { type: "string" } },
        chart_findings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              value: { type: ["string", "null"] },
              interpretation: { type: ["string", "null"] },
              confidence: { type: "number" },
            },
            required: ["label", "value", "interpretation", "confidence"],
          },
        },
        table_column_roles: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        source_regions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
          },
        },
        confidence: { type: "number" },
      },
      required: [
        "clinical_purpose",
        "key_terms",
        "medications",
        "thresholds",
        "actions",
        "monitoring_items",
        "flowchart_nodes",
        "flowchart_edges",
        "risk_matrix_axes",
        "risk_matrix_cells",
        "chart_axes",
        "chart_findings",
        "table_column_roles",
        "source_regions",
        "confidence",
      ],
    },
  },
  required: [
    "image_type",
    "searchable",
    "clinical_relevance_score",
    "labels",
    "caption",
    "skip_reason",
    "clinical_use_class",
    "clinical_use_reason",
    "clinical_signal_score",
    "admin_signal_score",
    "structured_visual_profile",
  ],
};

function sanitizeImageLabels(labels: unknown) {
  if (!Array.isArray(labels)) return [];
  return labels
    .map((label) =>
      String(label)
        .trim()
        .toLowerCase()
        .replace(/[^\w -]+/g, ""),
    )
    .filter((label) => label.length > 1)
    .slice(0, 6);
}

export async function classifyAndCaptionImageFromBase64(args: {
  base64: string;
  mimeType: string;
  nearbyText?: string;
  sourceKind?: string | null;
  candidateType?: string | null;
  tableLabel?: string | null;
  tableTitle?: string | null;
  tableRole?: string | null;
  tableText?: string | null;
}) {
  const extractionContext = [
    `Source kind: ${args.sourceKind ?? "unknown"}`,
    args.candidateType ? `Candidate type: ${args.candidateType}` : null,
    args.tableLabel ? `Table label: ${args.tableLabel}` : null,
    args.tableTitle ? `Table title: ${args.tableTitle}` : null,
    args.tableRole ? `Extractor table role: ${args.tableRole}` : null,
    args.tableText ? `Extracted table text:\n${args.tableText.slice(0, 2500)}` : null,
    `Nearby page text:\n${(args.nearbyText ?? "not available").slice(0, 3500)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const input = [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: extractionContext,
        },
        {
          type: "input_image",
          image_url: `data:${args.mimeType};base64,${args.base64}`,
          detail: "auto",
        },
      ],
    },
  ];

  const response = await generateStructuredTextResult(input, imageClassificationSchema, {
    model: env.OPENAI_VISION_MODEL,
    maxOutputTokens: 260,
    operation: "vision_classification",
    schemaName: "clinical_image_classification",
    instructions:
      "Classify an extracted clinical guideline image and write a concise caption. " +
      "Use searchable=true only when the image/table directly supports patient care, assessment, medication, dose, monitoring, observations, thresholds, risks, escalation, workflow, or clinical responsibilities. " +
      "Set clinical_use_class=administrative and searchable=false for authorisation/publication/version/effective-date/amendment/site/operational-area/applicable-to document-control tables, even when they mention mental health. " +
      "Set clinical_use_class=reference and searchable=false for bibliography, references, legislation, standards, or associated-document lists. " +
      "Role/responsibility tables are clinical only when the duties affect patient care, medication, monitoring, assessment, escalation, or clinical workflow; purely governance/service-director/document-control responsibility tables are administrative. " +
      "Set searchable false for logos, repeated decorative marks, empty crops, or images without clinical information. " +
      "Do not mark a text-heavy table crop as decorative solely because it has no illustration. " +
      "Do not infer patient-specific advice.",
    reasoningEffort: env.OPENAI_VISION_REASONING_EFFORT,
  });

  try {
    const parsed = JSON.parse(response.text) as Record<string, unknown>;
    const imageType = imageCategories.has(parsed.image_type as ImageEvidenceCategory)
      ? (parsed.image_type as ImageEvidenceCategory)
      : "unclear";
    const clinicalScore = Number(parsed.clinical_relevance_score);
    const assessment = assessClinicalImageUse({
      imageType,
      searchable: Boolean(parsed.searchable),
      clinicalRelevanceScore: clinicalScore,
      sourceKind: args.sourceKind,
      tableRole: args.tableRole,
      tableText: args.tableText,
      tableTitle: args.tableTitle,
      tableLabel: args.tableLabel,
      caption: typeof parsed.caption === "string" ? parsed.caption : null,
      labels: sanitizeImageLabels(parsed.labels),
      skipReason: typeof parsed.skip_reason === "string" ? parsed.skip_reason : null,
    });

    const profile: StructuredVisualProfile = normalizeStructuredVisualProfile(parsed.structured_visual_profile, {
      fallbackText: [
        args.tableTitle,
        args.tableLabel,
        typeof parsed.caption === "string" ? parsed.caption : "",
        args.tableText,
        args.nearbyText,
      ]
        .filter(Boolean)
        .join(" | "),
      fallbackConfidence: clinicalScore,
    });

    return {
      image_type: imageType,
      searchable: assessment.searchable && imageType !== "logo_decorative",
      clinical_relevance_score: assessment.clinical_relevance_score,
      labels: sanitizeImageLabels(parsed.labels),
      caption: String(parsed.caption || "").trim() || "Extracted source image.",
      skip_reason: assessment.searchable
        ? typeof parsed.skip_reason === "string" && parsed.skip_reason.trim()
          ? parsed.skip_reason.trim()
          : null
        : assessment.clinical_use_reason,
      clinical_use_class: assessment.clinical_use_class,
      clinical_use_reason: assessment.clinical_use_reason,
      clinical_signal_score: assessment.clinical_signal_score,
      admin_signal_score: assessment.admin_signal_score,
      structured_visual_profile: profile,
      structured_extraction_confidence: profile.confidence,
    };
  } catch {
    const assessment = assessClinicalImageUse({
      imageType: "unclear",
      searchable: true,
      clinicalRelevanceScore: 0.4,
      sourceKind: args.sourceKind,
      tableRole: args.tableRole,
      tableText: args.tableText,
      tableTitle: args.tableTitle,
      tableLabel: args.tableLabel,
      caption: response.text,
    });
    const profile = deterministicStructuredVisualProfile({
      imageType: "unclear",
      caption: response.text,
      tableTitle: args.tableTitle,
      tableLabel: args.tableLabel,
      tableTextSnippet: args.tableText,
      metadata: {},
    });
    return {
      image_type: "unclear" as const,
      searchable: assessment.searchable,
      clinical_relevance_score: assessment.clinical_relevance_score,
      labels: [],
      caption: response.text.trim() || "Extracted source image.",
      skip_reason: assessment.searchable ? null : assessment.clinical_use_reason,
      clinical_use_class: assessment.clinical_use_class,
      clinical_use_reason: assessment.clinical_use_reason,
      clinical_signal_score: assessment.clinical_signal_score,
      admin_signal_score: assessment.admin_signal_score,
      structured_visual_profile: profile,
      structured_extraction_confidence: profile.confidence,
    };
  }
}
