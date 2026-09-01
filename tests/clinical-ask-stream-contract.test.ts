import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClinicalAskStreamEvent } from "@/lib/clinical-ask/contracts";
import { streamClinicalAsk } from "@/lib/clinical-ask/client-stream";
import {
  ClinicalAskSseEncoder,
  encodeClinicalAskSse,
  parseClinicalAskSseFrame,
} from "@/lib/clinical-ask-stream-contract";

const failed = {
  state: "failed" as const,
  mode: "services" as const,
  code: "internal_error" as const,
  retryable: false,
  message: "Clinical Ask failed safely.",
};
const events: ClinicalAskStreamEvent[] = [
  { type: "progress", stage: "validating", elapsedMs: 0 },
  { type: "context_suggestions", suggestions: [] },
  {
    type: "clarification",
    response: { state: "clarification_required", mode: "services", suggestions: [], clarifications: [] },
  },
  { type: "evidence", evidence: [] },
  { type: "final", payload: { response: failed, feedback: null } },
  { type: "error", code: "internal_error", retryable: false, message: "Clinical Ask failed safely." },
];

describe("Clinical Ask SSE contract", () => {
  it.each(events)("round trips $type", (event) => {
    expect(parseClinicalAskSseFrame(encodeClinicalAskSse(event))).toEqual(event);
  });

  it("rejects unknown event and data keys", () => {
    expect(() =>
      parseClinicalAskSseFrame(
        'event: progress\ndata: {"type":"progress","stage":"validating","elapsedMs":0,"raw":"no"}\n\n',
      ),
    ).toThrow();
    expect(() =>
      parseClinicalAskSseFrame('event: provider.delta\ndata: {"type":"provider.delta","raw":"secret"}\n\n'),
    ).toThrow();
  });

  it("rejects oversized extracts", () => {
    const frame = encodeClinicalAskSse({ type: "evidence", evidence: [] }).replace(
      '"evidence":[]',
      `"evidence":[{"id":"x","tier":"indexed","title":"x","publisher":"x","jurisdiction":null,"href":"/x","extract":"${"x".repeat(2_001)}","reviewState":"reviewed","publishedAt":null,"updatedAt":null,"retrievedAt":null}]`,
    );
    expect(() => parseClinicalAskSseFrame(frame)).toThrow();
  });

  it("fails closed on answered payloads without governed evidence", () => {
    const response = {
      state: "answered",
      mode: "services",
      lead: { id: "lead", text: "Synthetic claim", evidenceIds: [] },
      sections: [],
      evidence: [],
      conflicts: [],
      missingInformation: [],
      followUps: [],
      handoffs: [],
    };
    expect(() =>
      parseClinicalAskSseFrame(
        `event: final\ndata: ${JSON.stringify({ type: "final", payload: { response, feedback: null } })}\n\n`,
      ),
    ).toThrow();
  });

  it("rejects visible claims that reference unknown evidence", () => {
    const evidence = {
      id: "e1",
      tier: "catalogue",
      title: "Synthetic source",
      publisher: "Synthetic publisher",
      jurisdiction: null,
      href: "/synthetic",
      extract: "Synthetic extract",
      reviewState: "reviewed",
      publishedAt: null,
      updatedAt: null,
      retrievedAt: null,
    };
    const response = {
      state: "answered",
      mode: "services",
      lead: { id: "lead", text: "Synthetic claim", evidenceIds: ["missing"] },
      sections: [],
      evidence: [evidence],
      conflicts: [],
      missingInformation: [],
      followUps: [],
      handoffs: [],
    };
    expect(() =>
      parseClinicalAskSseFrame(
        `event: final\ndata: ${JSON.stringify({ type: "final", payload: { response, feedback: null } })}\n\n`,
      ),
    ).toThrow();
  });

  it("enforces monotonic progress and one terminal event", () => {
    const encoder = new ClinicalAskSseEncoder();
    encoder.encode({ type: "progress", stage: "indexed", elapsedMs: 1 });
    expect(() => encoder.encode({ type: "progress", stage: "catalogue", elapsedMs: 2 })).toThrow();
    const terminal = new ClinicalAskSseEncoder();
    terminal.encode({ type: "final", payload: { response: failed, feedback: null } });
    expect(() =>
      terminal.encode({ type: "error", code: "internal_error", retryable: false, message: "safe" }),
    ).toThrow();
  });

  it("does not commit a malformed final event before a safe terminal error", () => {
    const encoder = new ClinicalAskSseEncoder();
    expect(() =>
      encoder.encode({
        type: "final",
        payload: {
          response: {
            state: "answered",
            mode: "services",
            lead: { id: "lead", text: "Unsupported", evidenceIds: [] },
            sections: [],
            evidence: [],
            conflicts: [],
            missingInformation: [],
            followUps: [],
            handoffs: [],
          },
          feedback: null,
        },
      }),
    ).toThrow();
    expect(() =>
      encoder.encode({ type: "error", code: "synthesis_invalid", retryable: false, message: "Failed safely." }),
    ).not.toThrow();
  });

  it("turns malformed provider-like stream data into a generic failure", async () => {
    const raw = "provider secret output";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`event: provider.delta\ndata: ${JSON.stringify({ raw })}\n\n`, {
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    );
    const result = await streamClinicalAsk(
      {
        mode: "services",
        question: "Synthetic question",
        confirmedContext: {},
        clarificationAnswers: {},
        priorTurns: [],
        allowExternalFallback: false,
        inputTransport: "typed",
      },
      new AbortController().signal,
      vi.fn(),
    );
    expect(result).toMatchObject({ response: { state: "failed", code: "internal_error" }, feedback: null });
    expect(JSON.stringify(result)).not.toContain(raw);
  });
});

afterEach(() => vi.unstubAllGlobals());
