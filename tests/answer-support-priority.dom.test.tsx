import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnswerUtilityActions, answerSupportPriority } from "@/components/clinical-dashboard/evidence-panels";
import type { AnswerState } from "@/components/ui/answer-state";
import { extractSafetyFindings } from "@/lib/clinical-safety";
import type { RagAnswer } from "@/lib/types";

/**
 * PR 13 provenance adoption. The live "Review source match" caution and the
 * design system's `RetrievalStateBanner` describe the same fact, so this file
 * pins that they cannot drift as the answer surface adopts `AnswerCard`.
 *
 * The regression it exists to catch is the silent one: an adoption that derives
 * the caution from `AnswerState` *instead of* the original three signals loses
 * cases, because the projection collapses a stale-and-ungrounded answer to
 * `stale_evidence` and a `kind === "ungrounded"` check would then drop the
 * warning entirely.
 */

const groundedAnswer: RagAnswer = {
  answer: "Titrate slowly and monitor.",
  grounded: true,
  confidence: "high",
  citations: [],
  sources: [],
};

const noSections: Parameters<typeof answerSupportPriority>[1] = [];
const noSafetyFindings: Parameters<typeof answerSupportPriority>[3] = [];

function priorityFor(
  options: Partial<Parameters<typeof answerSupportPriority>[4]> = {},
  answer: RagAnswer = groundedAnswer,
) {
  return answerSupportPriority(answer, noSections, null, noSafetyFindings, {
    grounded: true,
    weakEvidence: false,
    ...options,
  });
}

describe("answerSupportPriority · Review source match", () => {
  it("stays silent for a grounded answer with no degraded state", () => {
    expect(priorityFor()).toBeNull();
    expect(priorityFor({ answerState: { kind: "ready", sourceCount: 3 } })).toBeNull();
  });

  it("keeps firing on each original signal without any AnswerState", () => {
    // The three pre-adoption gates. An adoption that replaced them with the
    // projection would silently retire the caution on these answers.
    expect(priorityFor({ grounded: false })?.title).toBe("Review source match");
    expect(priorityFor({ weakEvidence: true })?.title).toBe("Review source match");
    expect(priorityFor({}, { ...groundedAnswer, answerQualityTier: "source_only" })?.title).toBe("Review source match");
  });

  it("fires for every degraded AnswerState kind, including the two the old gates missed", () => {
    const degraded: AnswerState[] = [
      { kind: "ungrounded", reason: "grounded_false", sourceCount: 2 },
      { kind: "ungrounded", reason: "unverified_numeric", sourceCount: 2 },
      { kind: "source_only", reason: "quality_gate" },
      { kind: "partial_retrieval", retrieved: 2, requested: 5, missing: [{ sourceId: "doc-9", title: "Formulary" }] },
      {
        kind: "stale_evidence",
        sourceCount: 3,
        overdue: [
          { sourceId: "doc-1", title: "WA Clozapine Protocol", reviewDueOn: "2025-11-01", status: "review_due" },
        ],
      },
    ];

    for (const answerState of degraded) {
      const priority = priorityFor({ answerState });
      expect(priority, `no caution for ${answerState.kind}`).not.toBeNull();
      expect(priority?.title).toBe("Review source match");
      expect(priority?.tone).toBe("caution");
    }
  });

  it("keeps the caution on an answer that is both stale and ungrounded", () => {
    // The projection reports `stale_evidence` here — outer kind by precedence —
    // so a check for `ungrounded` alone would find nothing and show no caution.
    const state: AnswerState = {
      kind: "stale_evidence",
      sourceCount: 2,
      overdue: [{ sourceId: "doc-1", title: "Superseded protocol", reviewDueOn: null, status: "outdated" }],
    };

    expect(priorityFor({ grounded: false, answerState: state })?.title).toBe("Review source match");
  });

  it("still puts safety findings above source review", () => {
    const safetyFindings = extractSafetyFindings({
      ...groundedAnswer,
      answer: "Avoid clozapine in this presentation.",
      citations: [
        {
          chunk_id: "chunk-1",
          document_id: "doc-1",
          title: "WA Clozapine Protocol",
          file_name: "clozapine.pdf",
          page_number: 12,
          snippet: "Avoid clozapine in severe neutropenia.",
        } as never,
      ],
      sources: [
        {
          id: "chunk-1",
          document_id: "doc-1",
          title: "WA Clozapine Protocol",
          file_name: "clozapine.pdf",
          page_number: 12,
          chunk_index: 0,
          section_heading: "Contraindications",
          content: "Avoid clozapine in severe neutropenia.",
          image_ids: [],
          similarity: 0.9,
          images: [],
        },
      ],
    });
    expect(safetyFindings.length).toBeGreaterThan(0);

    const priority = answerSupportPriority(groundedAnswer, noSections, null, safetyFindings, {
      grounded: false,
      weakEvidence: true,
      answerState: { kind: "ungrounded", reason: "grounded_false", sourceCount: 1 },
    });

    expect(priority?.title).toBe("Safety findings");
  });
});

describe("AnswerUtilityActions · feedback on a clean answer", () => {
  it("keeps Report a problem beside Copy with sources when priority and warnings are both empty", () => {
    render(
      <AnswerUtilityActions
        copied={false}
        onCopy={() => undefined}
        warnings={[]}
        pendingFeedback={null}
        onSubmitFeedback={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Copy answer with source status" })).toBeInTheDocument();
    expect(screen.getByTestId("answer-feedback-trigger")).toBeInTheDocument();
  });

  it("the answer surface mounts utilities independently and reserves the support card for a real priority", () => {
    const surface = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/answer-result-surface.tsx"),
      "utf8",
    );
    expect(surface).toContain("<AnswerUtilityActions");
    expect(surface).toMatch(/showInlineSupportCard = Boolean\(priority\)/);
  });
});
