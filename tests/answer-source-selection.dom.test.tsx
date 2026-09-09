import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { useAnswerSourceSelection } from "@/components/clinical-dashboard/use-answer-source-selection";

/**
 * The drawer's selection state, and the one thing it must never do: survive the
 * answer it was read from.
 *
 * `openIndex`, `claimIndex` and `claimSupport` are positions and statuses inside
 * a single answer. Carried into the next one they would put a clinician on a
 * different document under a different claim's support sentence — the precise
 * mis-attribution the whole mark mechanism exists to prevent — and the answer
 * surface is not keyed per turn, so nothing else would clear them.
 */
function Harness({ answerIdentity }: { answerIdentity: string }) {
  const selection = useAnswerSourceSelection(answerIdentity);
  return (
    <div>
      <button type="button" onClick={() => selection.openFromClaim(2, "partial")}>
        open from claim
      </button>
      <button type="button" onClick={() => selection.openFromRail(1)}>
        open from rail
      </button>
      <button type="button" onClick={selection.close}>
        close
      </button>
      <p data-testid="state">
        {String(selection.openIndex)}/{String(selection.claimIndex)}/{String(selection.claimSupport)}
      </p>
    </div>
  );
}

const state = () => screen.getByTestId("state").textContent;

describe("the answer's open-source selection", () => {
  it("carries the claim's own support status, not just the row it opened", async () => {
    const user = userEvent.setup();
    render(<Harness answerIdentity="answer-1" />);

    await user.click(screen.getByRole("button", { name: "open from claim" }));
    expect(state()).toBe("2/2/partial");
  });

  it("drops the claim when the same source is reopened from the rail", async () => {
    // Paging or opening from the rail means there is no claim to speak about,
    // so the drawer must stop asserting one rather than keep the last.
    const user = userEvent.setup();
    render(<Harness answerIdentity="answer-1" />);

    await user.click(screen.getByRole("button", { name: "open from claim" }));
    await user.click(screen.getByRole("button", { name: "open from rail" }));
    expect(state()).toBe("1/null/null");
  });

  it("clears every value when a new answer replaces the one underneath it", async () => {
    // The regression this exists for. Index 2 of the next answer is a different
    // document, and "partial" belonged to a claim that is no longer on screen.
    const user = userEvent.setup();
    const { rerender } = render(<Harness answerIdentity="answer-1" />);

    await user.click(screen.getByRole("button", { name: "open from claim" }));
    expect(state()).toBe("2/2/partial");

    rerender(<Harness answerIdentity="answer-2" />);
    expect(state()).toBe("null/null/null");
  });

  it("keeps the open source when the same answer merely re-renders", async () => {
    // The other half: a parent re-render must not close a drawer the clinician
    // is reading. Only a genuinely different answer resets it.
    const user = userEvent.setup();
    const { rerender } = render(<Harness answerIdentity="answer-1" />);

    await user.click(screen.getByRole("button", { name: "open from claim" }));
    rerender(<Harness answerIdentity="answer-1" />);
    expect(state()).toBe("2/2/partial");
  });

  it("closes to a clean state", async () => {
    const user = userEvent.setup();
    render(<Harness answerIdentity="answer-1" />);

    await user.click(screen.getByRole("button", { name: "open from claim" }));
    await user.click(screen.getByRole("button", { name: "close" }));
    expect(state()).toBe("null/null/null");
  });
});
