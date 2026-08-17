import { z } from "zod";
import type { UniversalSearchGroup, UniversalSearchResponse } from "@/lib/universal-search";

export type UniversalSearchStreamResponse = UniversalSearchResponse & {
  demoMode?: boolean;
  publicAccess?: boolean;
};

export type UniversalSearchStreamEvent =
  | { type: "group"; query: string; group: UniversalSearchGroup }
  | { type: "complete"; response: UniversalSearchStreamResponse }
  | { type: "error"; code: "universal_search_failed" };

const universalSearchItemSchema = z.looseObject({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  href: z.string(),
  score: z.number().optional(),
  badge: z.string().optional(),
  meta: z.string().optional(),
  confident: z.boolean().optional(),
});

const universalSearchGroupSchema = z.looseObject({
  kind: z.string(),
  total: z.number(),
  items: z.array(universalSearchItemSchema),
  latencyMs: z.number(),
  error: z.boolean().optional(),
});

const universalSearchStreamResponseSchema = z.looseObject({
  query: z.string(),
  groups: z.array(universalSearchGroupSchema),
  tookMs: z.number(),
  domainOrder: z.array(z.string()),
  demoMode: z.boolean().optional(),
  publicAccess: z.boolean().optional(),
});

export const universalSearchStreamEventSchema = z.discriminatedUnion("type", [
  z.looseObject({
    type: z.literal("group"),
    query: z.string(),
    group: universalSearchGroupSchema,
  }),
  z.looseObject({
    type: z.literal("complete"),
    response: universalSearchStreamResponseSchema,
  }),
  z.looseObject({
    type: z.literal("error"),
    code: z.literal("universal_search_failed"),
  }),
]);

function parseEvent(line: string): UniversalSearchStreamEvent {
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(line);
  } catch {
    throw new Error("Invalid universal-search NDJSON event.");
  }
  const parsed = universalSearchStreamEventSchema.safeParse(rawJson);
  if (!parsed.success) {
    throw new Error("Invalid universal-search NDJSON event.");
  }
  return parsed.data as UniversalSearchStreamEvent;
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted.", "AbortError");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortReason(signal);
}

/** Consume split NDJSON chunks, surfacing groups immediately and returning final JSON parity. */

export async function consumeUniversalSearchNdjson(
  response: Response,
  options: {
    signal?: AbortSignal;
    onGroup?: (group: UniversalSearchGroup, query: string) => void | Promise<void>;
  } = {},
): Promise<UniversalSearchStreamResponse> {
  throwIfAborted(options.signal);
  if (!response.body) throw new Error("Universal-search NDJSON response has no body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let complete: UniversalSearchStreamResponse | undefined;
  const cancelReader = () => {
    void reader.cancel(options.signal?.reason).catch(() => undefined);
  };
  options.signal?.addEventListener("abort", cancelReader, { once: true });

  const acceptLine = async (line: string) => {
    if (!line.trim()) return;
    const event = parseEvent(line);
    if (event.type === "group") await options.onGroup?.(event.group, event.query);
    else if (event.type === "complete") complete = event.response;
    else {
      const error = new Error("Universal search failed.");
      void reader.cancel(error).catch(() => undefined);
      throw error;
    }
  };

  try {
    while (true) {
      throwIfAborted(options.signal);
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        await acceptLine(line);
        newline = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) await acceptLine(buffer);
    throwIfAborted(options.signal);
    if (!complete) throw new Error("Universal-search NDJSON stream ended without a complete event.");
    return complete;
  } catch (error) {
    if (options.signal?.aborted) throw abortReason(options.signal);
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", cancelReader);
    reader.releaseLock();
  }
}
