import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PriorAnswerTurnSurface, type AnswerTurn } from "@/components/clinical-dashboard/answer-thread-turn";
import type { RagAnswer, SearchResult } from "@/lib/types";

/**
 * PR 13 answer adoption, product side of `#208`.
 *
 * `tests/answer-clipboard-composition.test.ts` pins the composer in isolation.
 * This file pins that the **product** copy button actually goes through it — the
 * regression it catches is a future edit quietly reverting `onCopy` to
 * `renderModel.copyText`, which would strip the attribution and the caveat from
 * everything a clinician pastes into a record while every other test stayed green.
 */

const source: SearchResult = {
  id: "chunk-1",
  document_id: "doc-1",
  title: "WA Clozapine Protocol",
  file_name: "clozapine.pdf",
  page_number: 12,
  chunk_index: 0,
  section_heading: "Titration",
  content: "Start at 12.5 mg at night and titrate slowly.",
  image_ids: [],
  similarity: 0.9,
  images: [],
};

function turnFor(answer: Partial<RagAnswer>): AnswerTurn {
  return {
    id: "turn-1",
    query: "clozapine starting dose",
    answer: {
      answer: "Start at 12.5 mg at night.",
      grounded: true,
      confidence: "high",
      citations: [],
      sources: [source],
      ...answer,
    },
    sources: [source],
  };
}

async function copiedTextFor(answer: Partial<RagAnswer>) {
  const onCopy = vi.fn();
  render(
    <PriorAnswerTurnSurface
      turn={turnFor(answer)}
      copied={false}
      collapsed={false}
      onToggleCollapsed={() => {}}
      onCopy={onCopy}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Copy answer with source status" }));
  expect(onCopy).toHaveBeenCalledOnce();
  return onCopy.mock.calls[0]?.[0] as string;
}

describe("product answer copy · goes through the #208 composer", () => {
  it("attributes the answer and keeps the whole render-policy block", async () => {
    const copied = await copiedTextFor({});

    expect(copied.startsWith("AI-generated from the cited sources.")).toBe(true);
    // The render-policy payload is still the body of the paste, not a summary of it.
    expect(copied).toContain("Clinical answer draft");
    expect(copied).toContain("Sources for review");
    expect(copied).toContain("Warnings");
    // A single thin source does not reach high render trust, so this fixture is
    // legitimately weak-evidence and carries that caveat. Recorded rather than
    // asserted away: the state comes from the render policy, not from the flags
    // on the fixture.
    expect(copied).toContain("Caveat: the evidence supporting this answer is weak.");
  });

  it("never claims a model wrote an extractive answer, even when it is also weak", async () => {
    // The defect this pins: `ungrounded` outranks `source_only` in the
    // projection, so keying attribution on the state kind pasted "AI-generated"
    // over passages no model wrote. The tier is passed explicitly for this reason.
    const copied = await copiedTextFor({ answerQualityTier: "source_only", grounded: false });

    expect(copied.startsWith("Assembled directly from the cited sources without model synthesis.")).toBe(true);
    expect(copied).not.toContain("AI-generated");
    expect(copied).toContain("Caveat: this answer could not be matched to the sources it cites.");
  });

  it("carries the ungrounded caveat into the paste, above the render block", async () => {
    const copied = await copiedTextFor({ grounded: false });

    const caveatIndex = copied.indexOf("Caveat: this answer could not be matched");
    expect(caveatIndex).toBeGreaterThanOrEqual(0);
    expect(caveatIndex).toBeLessThan(copied.indexOf("Clinical answer draft"));
  });

  it("names an unsupported-confidence answer rather than pasting it clean", async () => {
    const copied = await copiedTextFor({ confidence: "unsupported" });
    expect(copied).toContain("Caveat: this answer is reported as unsupported by the sources it cites.");
  });

  it("warns on unverified clinical values", async () => {
    const copied = await copiedTextFor({ unverifiedNumericTokens: ["12.5 mg"] });
    expect(copied).toContain("Caveat: some clinical values in this answer were not found in the cited sources.");
  });

  it("names a source-only answer as unsynthesised", async () => {
    const copied = await copiedTextFor({ answerQualityTier: "source_only" });
    expect(copied.startsWith("Assembled directly from the cited sources without model synthesis.")).toBe(true);
  });
});
