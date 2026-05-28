import OpenAI from "openai";
import { env, requireOpenAIEnv } from "@/lib/env";
import { PublicApiError } from "@/lib/http";
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
      return model === env.OPENAI_STRONG_ANSWER_MODEL ? env.OPENAI_STRONG_REASONING_EFFORT : env.OPENAI_FAST_REASONING_EFFORT;
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
    reasoning: supportsReasoning(resolved.model) && reasoningEffort !== "none" ? { effort: reasoningEffort } : undefined,
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
    return new PublicApiError("OpenAI timed out. Retry with a narrower question or fewer selected documents.", 504, {
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
    return new PublicApiError("OpenAI could not read one of the extracted images. Inspect the source file and retry.", 502, {
      code,
      requestId,
    });
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
    return {
      text: extractOutputText(data),
      model: options.model,
      operation,
      latencyMs: Date.now() - startedAt,
      requestId: requestId ?? getRequestId(data),
      usage: extractUsage(data),
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
      },
      requestOptions(),
    );
    const uniqueEmbeddings = response.data.map((item) => item.embedding);
    return outputIndexes.map((index) => uniqueEmbeddings[index]);
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
  },
  required: ["image_type", "searchable", "clinical_relevance_score", "labels", "caption", "skip_reason"],
};

function sanitizeImageLabels(labels: unknown) {
  if (!Array.isArray(labels)) return [];
  return labels
    .map((label) => String(label).trim().toLowerCase().replace(/[^\w -]+/g, ""))
    .filter((label) => label.length > 1)
    .slice(0, 6);
}

export async function classifyAndCaptionImageFromBase64(args: {
  base64: string;
  mimeType: string;
  nearbyText?: string;
}) {
  const input = [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: `Nearby page text:\n${args.nearbyText ?? "not available"}`,
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
      "Set searchable false for logos, repeated decorative marks, empty crops, or images without clinical information. " +
      "Do not infer patient-specific advice.",
    reasoningEffort: env.OPENAI_VISION_REASONING_EFFORT,
  });

  try {
    const parsed = JSON.parse(response.text) as Record<string, unknown>;
    const imageType = imageCategories.has(parsed.image_type as ImageEvidenceCategory)
      ? (parsed.image_type as ImageEvidenceCategory)
      : "unclear";
    const clinicalScore = Number(parsed.clinical_relevance_score);
    const searchable = Boolean(parsed.searchable) && imageType !== "logo_decorative";

    return {
      image_type: imageType,
      searchable,
      clinical_relevance_score: Number.isFinite(clinicalScore) ? Math.min(Math.max(clinicalScore, 0), 1) : 0.4,
      labels: sanitizeImageLabels(parsed.labels),
      caption: String(parsed.caption || "").trim() || "Extracted source image.",
      skip_reason: typeof parsed.skip_reason === "string" && parsed.skip_reason.trim() ? parsed.skip_reason.trim() : null,
    };
  } catch {
    return {
      image_type: "unclear" as const,
      searchable: true,
      clinical_relevance_score: 0.4,
      labels: [],
      caption: response.text.trim() || "Extracted source image.",
      skip_reason: null,
    };
  }
}
