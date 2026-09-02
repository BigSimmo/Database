import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("reaches Report a problem through the thumb down, beside Copy with sources", async () => {
    const user = userEvent.setup();
    render(
      <AnswerUtilityActions
        copied={false}
        onCopy={() => undefined}
        pendingFeedback={null}
        onSubmitFeedback={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Copy answer with source status" })).toBeInTheDocument();

    const report = screen.getByTestId("answer-feedback-trigger");
    expect(report).toHaveAccessibleName("Report a problem with this answer");
    // A dialog opener, not an in-flow disclosure: as a disclosure this list
    // opened partly behind the fixed phone composer and could not scroll itself
    // clear without hiding the phone chrome (see the comment on the Sheet).
    expect(report).toHaveAttribute("aria-haspopup", "dialog");
    expect(report).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("answer-review-panel")).not.toBeInTheDocument();

    await user.click(report);
    expect(report).toHaveAttribute("aria-expanded", "true");
    const sheet = await screen.findByTestId("answer-feedback-sheet");
    // The sheet asks the question in its own header, so the panel inside it
    // does not ask it a second time.
    expect(within(sheet).getByText("What is wrong with this answer?")).toBeInTheDocument();
    const panel = within(sheet).getByTestId("answer-review-panel");
    expect(panel).toHaveAttribute("data-tone", "problems");
    expect(panel).toHaveAttribute("data-chrome", "bare");
    expect(within(panel).queryByText("What is wrong with this answer?")).not.toBeInTheDocument();
    // The affirmative option is the thumb up, not an entry in a list opened to
    // report a fault — offering it here is a mis-click that records the
    // opposite of what the reader meant.
    expect(within(panel).queryByRole("button", { name: /Verified/ })).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /Wrong source/ })).toBeInTheDocument();
  });

  it("routes the safety sheet from the header chip now that the support card is gone", () => {
    const surface = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/answer-result-surface.tsx"),
      "utf8",
    );
    expect(surface).toContain("<AnswerUtilityActions");
    // The support card was removed on 2026-08-31 with the owner's decision that
    // the header chip carries safety instead. The chip is therefore the ONLY
    // route to the safety-critical findings sheet, so it must stay a button.
    expect(surface).not.toContain("<AnswerSupportSummaryCard");
    expect(surface).toContain('data-testid="answer-safety-findings-trigger"');
    expect(surface).toContain("onClick={openSafetyFindings}");
    // The governed verification wording moved below the answer with it, and the
    // surface must render it itself once it takes placement from the card.
    expect(surface).toContain('verificationPlacement="content"');
    expect(surface).toContain("<VerificationNotice {...answerVerification} />");
  });

  it("keeps the overdue-sources control inside the evidence-gaps disclosure", () => {
    // Owner decision, 2026-09-01: the control that names WHICH cited sources are
    // past their review date moved out of the answer body and into the
    // disclosure, with the other statements about this answer's evidence.
    const surface = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/answer-result-surface.tsx"),
      "utf8",
    );
    const content = readFileSync(
      resolve(process.cwd(), "src/components/clinical-dashboard/answer-content.tsx"),
      "utf8",
    );

    // Gone from the answer body, and its props with it.
    expect(content).not.toContain("<RetrievalStateBanner");
    expect(content).not.toContain("onOpenStateSource");

    // Present in the disclosure, and rendered before the warnings so the
    // governed caution leads what the reader sees on opening it.
    expect(surface).toContain("<RetrievalStateBanner");
    const detailStart = surface.indexOf('id="answer-evidence-gaps-detail"');
    const bannerInDetail = surface.indexOf("{overdueSourcesBanner}");
    const warningsInDetail = surface.indexOf("renderModel.warnings.map");
    expect(detailStart).toBeGreaterThan(-1);
    expect(bannerInDetail).toBeGreaterThan(detailStart);
    expect(warningsInDetail).toBeGreaterThan(bannerInDetail);

    // The disclosure must survive on an overdue-only answer, or moving the
    // banner in here would delete it outright rather than relocate it.
    expect(surface).toContain("renderModel.warnings.length > 0 || overdueSourcesBanner");
    // And the chip that opens it must exist for that answer too.
    expect(surface).toContain('const answerReviewDue = answerState.kind === "stale_evidence";');
    expect(surface).toContain("renderModel.warnings.length > 0 || answerReviewDue");

    // The chip's label must keep BOTH halves. On a source-only answer it is the
    // only thing on the default view that says a cited source is overdue —
    // `VerificationNotice` is `hidden print:flex` there and the collapsed
    // Source-only pill reads "Source-only · verify passages" — so a warning
    // count must never replace "Review due", and a currency warning must never
    // be counted as one of the gaps.
    expect(surface).toContain('"Review due"');
    expect(surface).toContain("isCurrencyReviewWarning");
    const labelStart = surface.indexOf("const answerEvidenceChipLabel");
    expect(labelStart).toBeGreaterThan(-1);
    const label = surface.slice(labelStart, labelStart + 400);
    expect(label).toContain('"Review due"');
    expect(label).toContain("answerGapWarningCount");
  });
});
