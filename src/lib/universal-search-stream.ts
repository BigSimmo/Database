import type { UniversalSearchGroup, UniversalSearchResponse } from "@/lib/universal-search";

export type UniversalSearchStreamResponse = UniversalSearchResponse & {
  demoMode?: boolean;
  publicAccess?: boolean;
};

export type UniversalSearchStreamEvent =
  | { type: "group"; query: string; group: UniversalSearchGroup }
  | { type: "complete"; response: UniversalSearchStreamResponse };

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted.", "AbortError");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortReason(signal);
}

function parseEvent(line: string): UniversalSearchStreamEvent {
  const parsed = JSON.parse(line) as Partial<UniversalSearchStreamEvent>;
  if (parsed.type === "group" && typeof parsed.query === "string" && parsed.group) {
    return parsed as Extract<UniversalSearchStreamEvent, { type: "group" }>;
  }
  if (parsed.type === "complete" && parsed.response) {
    return parsed as Extract<UniversalSearchStreamEvent, { type: "complete" }>;
  }
  throw new Error("Invalid universal-search NDJSON event.");
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
    else complete = event.response;
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
