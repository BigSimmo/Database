import { describe, expect, it } from "vitest";

import { createStreamingAnswerExtractor } from "@/lib/answer-stream-extractor";

// Feed a full JSON payload one character at a time, collecting the emitted prose deltas. This
// mirrors the worst-case streaming granularity (single-char chunks) the real extractor must survive.
function streamCharByChar(json: string): string {
  const extractor = createStreamingAnswerExtractor();
  let buffer = "";
  let out = "";
  for (const ch of json) {
    buffer += ch;
    out += extractor.push(buffer);
  }
  return out;
}

describe("createStreamingAnswerExtractor", () => {
  it("emits the answer prose incrementally and losslessly, char by char", () => {
    const answer = "Give 500 mg orally now, then reassess in 30 minutes.";
    const payload = JSON.stringify({ answer, confidence: "high", answerSections: [] });
    expect(streamCharByChar(payload)).toBe(answer);
  });

  it("returns nothing until the answer field opens", () => {
    const extractor = createStreamingAnswerExtractor();
    expect(extractor.push('{"confidence":"hi')).toBe("");
    expect(extractor.push('{"confidence":"high","answer":"Hel')).toBe("Hel");
  });

  it("never re-emits already-emitted prose across chunk boundaries", () => {
    const extractor = createStreamingAnswerExtractor();
    expect(extractor.push('{"answer":"Hello')).toBe("Hello");
    expect(extractor.push('{"answer":"Hello wor')).toBe(" wor");
    expect(extractor.push('{"answer":"Hello world"')).toBe("ld");
    expect(extractor.emittedLength).toBe("Hello world".length);
  });

  it("decodes JSON escapes (quotes, newlines) without leaking raw escape sequences", () => {
    const answer = 'Use the "PRN" order.\nThen document the dose.';
    const payload = JSON.stringify({ answer, confidence: "high" });
    expect(streamCharByChar(payload)).toBe(answer);
  });

  it("does not treat an escaped quote as the end of the value", () => {
    const extractor = createStreamingAnswerExtractor();
    // The \" is an escaped quote inside the value, not the closing quote.
    expect(extractor.push('{"answer":"say \\"hi\\" now')).toBe('say "hi" now');
  });

  it("holds back an incomplete trailing escape until the next chunk completes it", () => {
    const extractor = createStreamingAnswerExtractor();
    // Buffer cut right after the backslash — must not emit a dangling escape.
    expect(extractor.push('{"answer":"line one\\')).toBe("line one");
    expect(extractor.push('{"answer":"line one\\n')).toBe("\n");
  });

  it("handles a unicode escape split across chunk boundaries", () => {
    const answer = "café"; // é as é in JSON.stringify? No — stringify keeps é literal.
    const payload = JSON.stringify({ answer });
    expect(streamCharByChar(payload)).toBe(answer);
    // Explicit split unicode escape:
    const extractor = createStreamingAnswerExtractor();
    expect(extractor.push('{"answer":"A\\u00')).toBe("A"); // incomplete escape held back
    expect(extractor.push('{"answer":"A\\u00e9')).toBe("é");
  });

  it("emits nothing extra once the value is closed", () => {
    const extractor = createStreamingAnswerExtractor();
    extractor.push('{"answer":"done"');
    expect(extractor.push('{"answer":"done","confidence":"high"}')).toBe("");
  });
});
