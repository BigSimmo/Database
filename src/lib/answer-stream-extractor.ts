// Incremental extraction of the `answer` prose field from a streaming structured-JSON response.
//
// Answer generation uses a strict json_schema output, so the model streams raw JSON text
// (`{"answer":"…prose…","confidence":"high",…}`) rather than plain prose. To surface the answer
// as it streams — without changing what is generated (the final parsed answer is byte-identical
// to the non-streaming path) — we scan the accumulated raw buffer for the `answer` field's string
// value and emit only the newly-decoded characters since the last call.
//
// The scan stops at a safe boundary (an unescaped closing quote, or before an incomplete trailing
// escape), so JSON.parse of the captured fragment never fails on a mid-escape cut. If a fragment
// still cannot be decoded (e.g. a Unicode escape split across chunk boundaries), we emit nothing
// this round; the next, longer buffer completes it. Delivery is best-effort and lossless in
// aggregate — the authoritative answer always comes from parsing the final full payload.

const answerFieldOpening = /"answer"\s*:\s*"/;

/** Decode the JSON-escaped answer content captured up to a safe (non-mid-escape) boundary. */
function decodeCapturedAnswer(rawEscaped: string): string | null {
  try {
    return JSON.parse(`"${rawEscaped}"`) as string;
  } catch {
    return null;
  }
}

/**
 * Stateful extractor over a growing raw-JSON buffer. Call `push(fullBufferSoFar)` on each streamed
 * chunk (passing the entire accumulated buffer, not just the new bytes); it returns the decoded
 * answer-prose delta to append to the UI, or "" when there is nothing new yet.
 */
export function createStreamingAnswerExtractor() {
  let emitted = 0;

  return {
    push(rawBuffer: string): string {
      const opening = answerFieldOpening.exec(rawBuffer);
      if (!opening) return "";
      const valueStart = opening.index + opening[0].length;

      let escaped = "";
      let i = valueStart;
      while (i < rawBuffer.length) {
        const ch = rawBuffer[i];
        if (ch === "\\") {
          const next = rawBuffer[i + 1];
          // Incomplete trailing escape (buffer cut right after a backslash) — stop before it.
          if (next === undefined) break;
          if (next === "u") {
            // \uXXXX needs four hex digits; if the buffer cuts inside them, hold back the whole
            // escape and emit only the safe prefix decoded so far.
            if (i + 6 > rawBuffer.length) break;
            escaped += rawBuffer.slice(i, i + 6);
            i += 6;
            continue;
          }
          escaped += rawBuffer[i] + next;
          i += 2;
          continue;
        }
        if (ch === '"') break; // unescaped closing quote — the answer value is complete
        escaped += ch;
        i += 1;
      }

      const decoded = decodeCapturedAnswer(escaped);
      if (decoded === null || decoded.length <= emitted) return "";
      const delta = decoded.slice(emitted);
      emitted = decoded.length;
      return delta;
    },
    /** Total decoded prose length emitted so far (for tests / diagnostics). */
    get emittedLength() {
      return emitted;
    },
  };
}
