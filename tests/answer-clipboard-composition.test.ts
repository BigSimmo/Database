import { describe, expect, it } from "vitest";

import type { AnswerState } from "@/components/ui/answer-state";
import {
  answerClipboardCaveatLine,
  answerClipboardProvenanceLine,
  answerStateAttribution,
  composeAnswerClipboardText,
} from "@/lib/answer-clipboard";
import { formatAnswerRenderCopyText, type SourceLink } from "@/lib/answer-render-policy";

/**
 * PR-J Phase 1 blocker 2 of 2 (ledger `#208`, SPEC §13 PR 6 clinical review 1).
 *
 * The decision recorded here in executable form: the live product's clipboard
 * payload stays `formatAnswerRenderCopyText()`, and the design-system rules that
 * string lacks are composed on top of it. The failure this file exists to catch
 * is the tempting simplification — adopting `answerClipboardText()` as the
 * product copy path — which silently drops the render policy's warnings.
 */

const source: SourceLink = {
  id: "chunk-1",
  chunk_id: "chunk-1",
  document_id: "doc-1",
  title: "WA Clozapine Protocol",
  file_name: "clozapine.pdf",
  page_number: 12,
  href: "/documents/doc-1",
  label: "WA Clozapine Protocol, p. 12",
  sourceStrength: "strong",
  reason: "direct support",
};

function renderCopyText() {
  return formatAnswerRenderCopyText({
    answerText: "Start at 12.5 mg at night.",
    trust: "medium",
    primarySources: [source],
    warnings: ["Unverified numeric value: 12.5 mg", "Faithfulness check did not pass"],
  });
}

const ready: AnswerState = { kind: "ready", sourceCount: 1 };

describe("composeAnswerClipboardText · #208 compose, do not replace", () => {
  it("passes the render-policy payload through byte-for-byte", () => {
    // The whole point of the decision: warnings, render trust, numbered sources
    // and match strength are the render policy's to decide, and the composer is
    // not allowed to edit, reorder or re-derive any of them.
    const render = renderCopyText();
    const composed = composeAnswerClipboardText({ renderCopyText: render, state: ready });

    expect(composed).toContain(render);
  });

  it("keeps every render-policy warning in the copied text", () => {
    const composed = composeAnswerClipboardText({ renderCopyText: renderCopyText(), state: ready });

    expect(composed).toContain("Warnings");
    expect(composed).toContain("- Unverified numeric value: 12.5 mg");
    expect(composed).toContain("- Faithfulness check did not pass");
    expect(composed).toContain("Render trust: medium");
    expect(composed).toContain("1. WA Clozapine Protocol, p. 12 | strong match | /documents/doc-1");
  });

  it("adds the unconditional attribution even on a ready answer", () => {
    const composed = composeAnswerClipboardText({ renderCopyText: renderCopyText(), state: ready });

    expect(composed.startsWith("AI-generated from the cited sources.")).toBe(true);
    // The render block's own verify instruction is not duplicated.
    expect(composed.match(/Verify against/g)).toHaveLength(1);
  });

  it("names a source-only answer as unsynthesised rather than AI-generated", () => {
    const composed = composeAnswerClipboardText({
      renderCopyText: renderCopyText(),
      state: { kind: "source_only", reason: "quality_gate" },
    });

    expect(composed.startsWith("Assembled directly from the cited sources without model synthesis.")).toBe(true);
    expect(composed).not.toContain("AI-generated");
  });

  it("carries the AnswerState caveat above the render block, where a truncated paste keeps it", () => {
    const composed = composeAnswerClipboardText({
      renderCopyText: renderCopyText(),
      state: { kind: "ungrounded", reason: "unverified_numeric", sourceCount: 1 },
    });

    const caveatIndex = composed.indexOf("Caveat: some clinical values");
    expect(caveatIndex).toBeGreaterThanOrEqual(0);
    expect(caveatIndex).toBeLessThan(composed.indexOf("Clinical answer draft"));
  });

  it("carries the stale-evidence fraction the render policy does not state", () => {
    const composed = composeAnswerClipboardText({
      renderCopyText: renderCopyText(),
      state: {
        kind: "stale_evidence",
        sourceCount: 3,
        overdue: [
          { sourceId: "doc-1", title: "WA Clozapine Protocol", reviewDueOn: "2025-11-01", status: "review_due" },
          { sourceId: "doc-2", title: "RANZCP Guideline", reviewDueOn: null, status: "outdated" },
        ],
      },
    });

    expect(composed).toContain("Caveat: 2 of 3 cited sources are past their review date.");
  });

  it("adds no caveat to a ready answer", () => {
    const composed = composeAnswerClipboardText({ renderCopyText: renderCopyText(), state: ready });
    expect(composed).not.toContain("Caveat:");
  });

  it("appends the single provenance audit line last when metadata is supplied", () => {
    const composed = composeAnswerClipboardText({
      renderCopyText: renderCopyText(),
      state: ready,
      metadata: { document_status: "current", review_date: "2026-01-01" },
    });

    expect(composed).toContain("Designation:");
    expect(composed).toContain("Review status:");
    expect(composed.indexOf("Review status:")).toBeGreaterThan(composed.indexOf("Warnings"));
  });

  it("suppresses the single-document provenance line when it would contradict the caveat", () => {
    const composed = composeAnswerClipboardText({
      renderCopyText: renderCopyText(),
      state: {
        kind: "stale_evidence",
        sourceCount: 6,
        overdue: [
          { sourceId: "doc-1", title: "WA Clozapine Protocol", reviewDueOn: "2025-11-01", status: "review_due" },
        ],
      },
      metadata: { document_status: "current", review_date: "2026-01-01" },
    });

    expect(composed).toContain("1 of 6 cited sources are past their review date");
    expect(composed).not.toContain("Review status:");
  });

  it("omits provenance entirely when no metadata was supplied", () => {
    // Synthesising an all-Unknown audit line would assert a governance read that
    // never happened.
    const composed = composeAnswerClipboardText({ renderCopyText: renderCopyText(), state: ready });
    expect(composed).not.toContain("Designation:");
  });
});

describe("shared clipboard rules · one implementation, two callers", () => {
  it("exposes attribution, caveat and provenance as the single source of each rule", () => {
    // `answerClipboardText()` in the design system and the product composer above
    // both call these. A second implementation of any of them is the drift #208
    // was raised to prevent.
    expect(answerStateAttribution(ready)).toBe("AI-generated from the cited sources.");
    expect(answerClipboardCaveatLine(ready)).toBeNull();
    expect(answerClipboardCaveatLine({ kind: "ungrounded", reason: "grounded_false", sourceCount: 2 })).toMatch(
      /^Caveat: this answer could not be matched/,
    );
    expect(answerClipboardProvenanceLine(ready, null)).toBeNull();
    expect(answerClipboardProvenanceLine(ready, { document_status: "current" })).toContain("Review status:");
  });
});
