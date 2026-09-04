// #100 Phase 0 — offline contract proof for incremental verified delivery
// (docs/verified-answer-incremental-delivery-design.md). These tests must hold before
// any client renders a verified unit: schema/sequence validation, rejection of the
// removed token/revising shapes, governance refusal emitting zero units, owner-boundary
// trimming, and byte-identical preview/final reconciliation at the trim layer.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { toClientAnswerPayload, trimSourceForClient } from "../src/lib/answer-client-payload";
import {
  buildCachedEvidencePreviewProgress,
  buildEvidencePreviewProgress,
  readLastEvidencePreviewReason,
  buildEvidencePreviewUnit,
} from "../src/lib/answer-preview";
import { toPublicAnswerProgressEvent } from "../src/lib/answer-progress-public";
import {
  isAnswerStreamEventName,
  isDeliverableVerifiedUnit,
  type VerifiedEvidencePreviewUnit,
} from "../src/lib/answer-stream-contract";
import type { SearchResult } from "../src/lib/types";

function makeSource(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "Clozapine Monitoring",
    file_name: "clozapine.pdf",
    page_number: 3,
    chunk_index: 1,
    section_heading: "Monitoring",
    content: "ANC thresholds and FBC monitoring schedule for clozapine.",
    image_ids: [],
    similarity: 0.82,
    // Server-only fields that must never cross the route boundary.
    adjacent_context: "SERVER-ONLY adjacent context",
    memory_cards: [{ card: "SERVER-ONLY memory card" }],
    table_facts: [{ fact: "SERVER-ONLY table fact" }],
    document_summary: "SERVER-ONLY document summary",
    images: [{ id: "img-1", caption: "SERVER-ONLY caption" }],
    ...overrides,
  } as unknown as SearchResult;
}

const previewUnit = (): VerifiedEvidencePreviewUnit => ({
  schemaVersion: 1,
  kind: "evidence_preview",
  sequence: 0,
  sources: [trimSourceForClient(makeSource())],
  selectedContextCount: 1,
});

const sectionUnit = () => ({
  schemaVersion: 1,
  kind: "answer_section",
  sequence: 2,
  section: { heading: "Monitoring", body: "Check levels.", citation_chunk_ids: ["chunk-1"] },
  citations: [
    {
      chunk_id: "chunk-1",
      document_id: "doc-1",
      title: "Clozapine Monitoring",
      file_name: "clozapine.pdf",
      page_number: 3,
      chunk_index: 1,
    },
  ],
  supportLevel: "direct",
});

describe("verified-unit stream contract (#100 Phase 0)", () => {
  it("accepts well-formed evidence and section previews", () => {
    expect(isDeliverableVerifiedUnit(previewUnit())).toBe(true);
    expect(isDeliverableVerifiedUnit(sectionUnit(), 1)).toBe(true);
  });

  it("rejects unknown schema versions and kinds", () => {
    expect(isDeliverableVerifiedUnit({ ...previewUnit(), schemaVersion: 2 })).toBe(false);
    expect(isDeliverableVerifiedUnit({ ...previewUnit(), kind: "token" })).toBe(false);
    expect(isDeliverableVerifiedUnit({ ...previewUnit(), kind: "revising" })).toBe(false);
    expect(isDeliverableVerifiedUnit(null)).toBe(false);
    expect(isDeliverableVerifiedUnit("token")).toBe(false);
  });

  it("enforces strictly increasing sequences within one response", () => {
    const section = sectionUnit();
    expect(isDeliverableVerifiedUnit(section, 1)).toBe(true);
    expect(isDeliverableVerifiedUnit(section, 2)).toBe(false);
    expect(isDeliverableVerifiedUnit(section, 3)).toBe(false);
    // Evidence previews are pinned to sequence 0 and therefore only valid first.
    expect(isDeliverableVerifiedUnit(previewUnit(), null)).toBe(true);
    expect(isDeliverableVerifiedUnit(previewUnit(), 0)).toBe(false);
    expect(isDeliverableVerifiedUnit({ ...previewUnit(), sequence: 1 })).toBe(false);
  });

  it("rejects empty, over-cap, non-finite, and non-integer evidence previews", () => {
    expect(isDeliverableVerifiedUnit({ ...previewUnit(), sources: [] })).toBe(false);
    expect(
      isDeliverableVerifiedUnit({
        ...previewUnit(),
        sources: Array.from({ length: 13 }, (_, index) => trimSourceForClient(makeSource({ id: `chunk-${index}` }))),
        selectedContextCount: 13,
      }),
    ).toBe(false);
    expect(isDeliverableVerifiedUnit({ ...previewUnit(), selectedContextCount: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isDeliverableVerifiedUnit({ ...previewUnit(), selectedContextCount: 1.5 })).toBe(false);
  });

  // G1 (docs/clinical-hazard-analysis.md H5a). The streamed preview must accept exactly the
  // `similarity_origin` union in types.ts. If the union grows and this allow-set does not, the
  // preview silently rejects a payload `final` accepts — the client then falls back to the
  // slow path with no error anyone sees.
  it("accepts every declared similarity_origin value and nothing else", () => {
    const declaredOrigins = ["cosine", "synthetic_text", "document_context"] as const;
    // Compile-time exhaustiveness: adding a member to the union without listing it here makes
    // `Unlisted` something other than `never`, and this annotation stops typechecking. Without
    // it the runtime loop below would keep passing while silently skipping the new value.
    type Unlisted = Exclude<NonNullable<SearchResult["similarity_origin"]>, (typeof declaredOrigins)[number]>;
    const everyOriginListed: [Unlisted] extends [never] ? true : never = true;
    expect(everyOriginListed).toBe(true);

    for (const origin of declaredOrigins) {
      expect(
        isDeliverableVerifiedUnit({
          ...previewUnit(),
          sources: [trimSourceForClient(makeSource({ similarity_origin: origin }))],
        }),
      ).toBe(true);
    }

    expect(
      isDeliverableVerifiedUnit({
        ...previewUnit(),
        sources: [trimSourceForClient(makeSource({ similarity_origin: "made_up_origin" as never }))],
      }),
    ).toBe(false);
  });

  it("rejects raw server fields at the stream boundary", () => {
    expect(
      isDeliverableVerifiedUnit({
        ...previewUnit(),
        sources: [makeSource()],
      }),
    ).toBe(false);
    expect(
      isDeliverableVerifiedUnit({
        ...previewUnit(),
        sources: [{ ...previewUnit().sources[0], adjacent_context: "private generation context" }],
      }),
    ).toBe(false);
  });

  it("rejects malformed answer sections, citations, and support levels", () => {
    const valid = sectionUnit();
    expect(isDeliverableVerifiedUnit({ ...valid, section: { heading: "Monitoring", content: "wrong field" } }, 1)).toBe(
      false,
    );
    expect(isDeliverableVerifiedUnit({ ...valid, citations: [{ chunk_id: "incomplete" }] }, 1)).toBe(false);
    expect(isDeliverableVerifiedUnit({ ...valid, supportLevel: "unverified" }, 1)).toBe(false);
    expect(isDeliverableVerifiedUnit({ ...valid, section: { ...valid.section, supportLevel: "partial" } }, 1)).toBe(
      false,
    );
  });

  it("rejects unbounded payloads", () => {
    const oversized = {
      ...previewUnit(),
      sources: Array.from({ length: 12 }, (_, index) =>
        trimSourceForClient(
          makeSource({
            id: `chunk-${index}`,
            content: "x".repeat(900),
            match_explanation: { reasons: ["y".repeat(5_000)] },
          }),
        ),
      ),
      selectedContextCount: 12,
    };
    expect(isDeliverableVerifiedUnit(oversized)).toBe(false);
  });

  it("keeps the token and revising SSE event names excluded", () => {
    expect(isAnswerStreamEventName("token")).toBe(false);
    expect(isAnswerStreamEventName("revising")).toBe(false);
    expect(isAnswerStreamEventName("progress")).toBe(true);
  });
});

describe("evidence preview builder (#100 Phase 1 server gate)", () => {
  it("emits zero units when a danger-level governance warning exists", () => {
    const outdated = makeSource({
      source_metadata: { document_status: "outdated" } as SearchResult["source_metadata"],
    });
    expect(buildEvidencePreviewUnit({ results: [outdated] })).toBeNull();
  });

  it("excludes the danger-level document and still shows the clean sources beside it", () => {
    // The behaviour this replaces suppressed the whole rail whenever any retrieved passage
    // failed governance, which on a real corpus meant one badly-OCR'd chunk hid every good
    // source in the answer. Excluding the flagged document is strictly safer per card: it can
    // no longer appear in the preview at all, where the old wide check only delayed it until
    // the answer's own rail.
    const safe = makeSource();
    const outdated = makeSource({
      id: "chunk-outdated",
      document_id: "doc-outdated",
      source_metadata: { document_status: "outdated" } as SearchResult["source_metadata"],
    });

    const unit = buildEvidencePreviewUnit({ results: [safe, outdated] });
    expect(unit).not.toBeNull();
    expect(unit!.sources.map((source) => source.document_id)).toEqual(["doc-1"]);
    // Counts what survived, never the wider set: the contract requires
    // selectedContextCount >= sources.length, and a count including the excluded document
    // would describe evidence the preview is deliberately not showing.
    expect(unit!.selectedContextCount).toBe(1);
  });

  it("excludes every chunk of a danger-level document, not only the flagged chunk", () => {
    const safe = makeSource();
    const poorFirst = makeSource({
      id: "chunk-poor-1",
      document_id: "doc-poor",
      source_metadata: { extraction_quality: "poor" } as SearchResult["source_metadata"],
    });
    // Same document, no flag of its own — governance is a property of the document, so this
    // chunk must go with it rather than standing in as a clean card for the same PDF.
    const poorSecond = makeSource({ id: "chunk-poor-2", document_id: "doc-poor" });

    const unit = buildEvidencePreviewUnit({ results: [safe, poorFirst, poorSecond] });
    expect(unit).not.toBeNull();
    expect(unit!.sources.map((source) => source.id)).toEqual(["chunk-1"]);
  });

  it("excludes danger-level documents past the warnings display cap", () => {
    // `sourceGovernanceWarnings` ends with `.slice(0, limit ?? 8)`, a cap sized for a warnings
    // banner. An earlier cut of this filter read its exclusion set out of that capped list, so
    // the ninth danger warning onwards was silently dropped and its document was disclosed as
    // a preview card. Five documents that are both outdated and poorly extracted produce ten
    // danger warnings, which is enough to push the last one out.
    const flagged = Array.from({ length: 5 }, (_unused, index) =>
      makeSource({
        id: `chunk-flagged-${index}`,
        document_id: `doc-flagged-${index}`,
        source_metadata: {
          document_status: "outdated",
          extraction_quality: "poor",
        } as SearchResult["source_metadata"],
      }),
    );
    // Poor extraction only, so `document_status` stays "current" — the card badge reads only
    // that field, so a document escaping the cap this way would be shown labelled "Current".
    const badlyExtracted = makeSource({
      id: "chunk-poor-ocr",
      document_id: "doc-poor-ocr",
      source_metadata: { document_status: "current", extraction_quality: "poor" } as SearchResult["source_metadata"],
    });
    const safe = makeSource();

    const unit = buildEvidencePreviewUnit({ results: [...flagged, badlyExtracted, safe] });
    expect(unit).not.toBeNull();
    expect(unit!.sources.map((source) => source.document_id)).toEqual(["doc-1"]);
  });

  it("suppresses the whole preview when the danger verdict is answer-level, not per document", () => {
    // `WEAK_EVIDENCE` from relevance.verdict === "none" says the retrieved evidence does not
    // back the question at all. That is not a property of any one document, so no subset of
    // the rail is safe to show and the all-or-nothing path must survive.
    const unit = buildEvidencePreviewUnit({
      results: [makeSource(), makeSource({ id: "chunk-2", document_id: "doc-2" })],
      relevance: { isSourceBacked: false, verdict: "none" } as never,
    });
    expect(unit).toBeNull();
  });

  it("emits zero units for empty retrieval", () => {
    expect(buildEvidencePreviewUnit({ results: [] })).toBeNull();
  });

  it("never lets server-only source fields cross the boundary", () => {
    const unit = buildEvidencePreviewUnit({ results: [makeSource()] });
    expect(unit).not.toBeNull();
    const serialized = JSON.stringify(unit);
    expect(serialized).not.toContain("SERVER-ONLY");
    const source = unit!.sources[0] as unknown as Record<string, unknown>;
    expect(source.adjacent_context).toBeUndefined();
    expect(source.memory_cards).toBeUndefined();
    expect(source.table_facts).toBeUndefined();
    expect(source.document_summary).toBeUndefined();
    expect(source.images).toEqual([]);
  });

  it("is byte-identical to the final payload's trim of the same sources", () => {
    const results = [makeSource(), makeSource({ id: "chunk-2", content: "y".repeat(2000) })];
    const unit = buildEvidencePreviewUnit({ results });
    const finalPayload = toClientAnswerPayload({ sources: results });
    expect(JSON.stringify(unit!.sources)).toBe(JSON.stringify(finalPayload.sources));
  });

  it("bounds the preview to the source cap while reporting the full selected count", () => {
    const results = Array.from({ length: 20 }, (_, index) => makeSource({ id: `chunk-${index}` }));
    const unit = buildEvidencePreviewUnit({ results });
    expect(unit!.sources).toHaveLength(12);
    expect(unit!.selectedContextCount).toBe(20);
    expect(isDeliverableVerifiedUnit(unit)).toBe(true);
  });
});

describe("public progress DTO passthrough", () => {
  it("passes a valid verified unit through the ranking stage", () => {
    const event = toPublicAnswerProgressEvent({ stage: "ranking", resultCount: 3, verifiedUnit: previewUnit() });
    expect(event?.verifiedUnit).toBeDefined();
    expect(event?.verifiedUnit?.kind).toBe("evidence_preview");
  });

  it("drops duplicate and out-of-order verified units once a stream has accepted sequence 0", () => {
    const first = toPublicAnswerProgressEvent({ stage: "retrieved", verifiedUnit: previewUnit() });
    expect(first?.verifiedUnit?.sequence).toBe(0);
    expect(
      toPublicAnswerProgressEvent({ stage: "retrieved", verifiedUnit: previewUnit() }, 0)?.verifiedUnit,
    ).toBeUndefined();
    expect(
      toPublicAnswerProgressEvent(
        {
          stage: "generating",
          verifiedUnit: { ...sectionUnit(), sequence: 1 },
        },
        0,
      )?.verifiedUnit?.sequence,
    ).toBe(1);
  });

  it("drops malformed verified units instead of repairing them", () => {
    const event = toPublicAnswerProgressEvent({
      stage: "retrieved",
      verifiedUnit: { schemaVersion: 1, kind: "token", sequence: 0, text: "raw model prose" },
    });
    expect(event).not.toBeNull();
    expect(event?.verifiedUnit).toBeUndefined();
  });

  it("emits no verified unit by default (flag off end-to-end)", () => {
    const event = toPublicAnswerProgressEvent({ stage: "retrieved", resultCount: 3 });
    expect(event?.verifiedUnit).toBeUndefined();
  });
});

describe("evidence preview emission (#100 — why a wait shows no sources)", () => {
  it("shows the rail on a cached answer instead of returning nothing", () => {
    // A cache hit returns before the ranking event, so until this every repeated question
    // showed a wait with no sources while a first-time question showed them. Repeats are the
    // common case here: the same question comes up on the next patient.
    const fields = buildCachedEvidencePreviewProgress({ results: [makeSource()] });
    expect(fields.previewReason).toBe("ok");
    expect(fields.verifiedUnit?.sources).toHaveLength(1);
  });

  // The wiring, not just the helper. A unit test of `buildCachedEvidencePreviewProgress` alone
  // passed happily while production emitted nothing on a cache hit — the same shape of gap that
  // made this bug survive two rounds of "verified". Every cached progress event that has the
  // sources in hand (it reports `resultCount`) must actually attach the preview. The
  // inflight-coalesced event is deliberately excluded: it is waiting on another request and has
  // no sources to offer yet.
  it("attaches the preview at every cached progress event that has sources in hand", () => {
    const ragSource = readFileSync(new URL("../src/lib/rag/rag.ts", import.meta.url), "utf8");
    const cachedEvents = [...ragSource.matchAll(/stage: "cached",[\s\S]{0,1200}?\n    \}\);/g)].map(
      (match) => match[0],
    );
    expect(cachedEvents.length).toBeGreaterThanOrEqual(2);

    const withSources = cachedEvents.filter((event) => event.includes("resultCount:"));
    expect(withSources.length).toBeGreaterThanOrEqual(2);
    for (const event of withSources) {
      expect(event).toContain("buildCachedEvidencePreviewProgress");
    }
  });

  it("falls back to the generation context when the retry intersection is empty", () => {
    // The two context sets apply the per-document cap to different input lists, so the
    // intersection can empty out while retrieval and ranking are perfectly healthy.
    const normal = makeSource({ id: "chunk-normal" });
    const fallback = makeSource({ id: "chunk-strong", document_id: "doc-strong" });

    const fields = buildEvidencePreviewProgress({ normalResults: [normal], fallbackResults: [fallback] });
    expect(fields.previewReason).toBe("empty_intersection_relaxed");
    expect(fields.verifiedUnit?.sources.map((source) => source.id)).toEqual(["chunk-normal"]);
  });

  it("keeps the stable intersection when there is one", () => {
    const shared = makeSource();
    const fields = buildEvidencePreviewProgress({ normalResults: [shared], fallbackResults: [shared] });
    expect(fields.previewReason).toBe("ok");
    expect(fields.verifiedUnit?.sources).toHaveLength(1);
  });

  it("names why it withheld, rather than returning a bare absence", () => {
    expect(buildEvidencePreviewProgress({ normalResults: [], fallbackResults: [] }).previewReason).toBe(
      "no_candidates",
    );
    expect(
      buildCachedEvidencePreviewProgress({
        results: [makeSource()],
        relevance: { isSourceBacked: false, verdict: "none" } as never,
      }).previewReason,
    ).toBe("answer_level_danger");
    expect(
      buildCachedEvidencePreviewProgress({
        results: [makeSource({ source_metadata: { document_status: "outdated" } as SearchResult["source_metadata"] })],
      }).previewReason,
    ).toBe("all_sources_danger");
  });

  it("records a contract rejection at the route boundary, which had no upstream reason", () => {
    // The builder says "ok" and the boundary then discards the unit — the one preview failure
    // that used to vanish without trace.
    const event = toPublicAnswerProgressEvent({
      stage: "ranking",
      previewReason: "ok",
      verifiedUnit: { schemaVersion: 1, kind: "evidence_preview", sequence: 0, sources: [], selectedContextCount: 0 },
    });
    expect(event?.previewReason).toBe("contract_rejected");
    expect(event?.verifiedUnit).toBeUndefined();
    expect(readLastEvidencePreviewReason()?.reason).toBe("contract_rejected");
  });

  it("passes a genuine absence through without calling it a rejection", () => {
    const event = toPublicAnswerProgressEvent({ stage: "ranking", previewReason: "all_sources_danger" });
    expect(event?.previewReason).toBe("all_sources_danger");
  });
});
