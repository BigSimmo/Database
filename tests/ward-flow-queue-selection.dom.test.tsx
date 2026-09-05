import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { stageCopy } from "@/components/ward-management/ward-derivations";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **RE-POINTED AT `DelaysScreen` ON 2026-09-05, AND THE OBVIOUS CALL — "retire it, the bug it
 * guards cannot exist here" — WAS THE WRONG ONE.**
 *
 * This file rendered `<WardModeWorkspace mode="queue" />`. MERGE 01 folded the priority queue, the
 * exceptions inbox and the escalation board into `DelaysScreen` and made
 * `/mockups/ward-flow/queue` a redirect, so the pin went on passing over a screen no coordinator
 * can open.
 *
 * **The property is not about a selection control. It is about STALENESS.** `QueueView` held the
 * selected movement as `useState(movements[0])` — the record object itself, captured once at
 * mount — so a dispatch that later changed that record was never reflected: the panel rendered
 * pre-dispatch fields forever. The fix held the id and derived the record from live state.
 *
 * ⚠️ **`DelaysScreen` HAS NO LOCAL STATE AT ALL, WHICH IS EXACTLY WHY RETIRING THIS LOOKED
 * CORRECT — AND WHY IT WOULD HAVE LEFT A HOLE.** Nothing is captured, so that particular bug shape
 * is unreachable *today*. But the property a reader actually depends on is the observable one: **a
 * change dispatched after this screen mounts must appear on it.** Measured 2026-09-05, before
 * deciding: `ward-delays-screen.dom.test.tsx` contains 14 cases and **not one `fireEvent` or
 * `dispatch` among them** — every case is a single static render — and a repository-wide search for
 * tests naming `DelaysScreen` found no dispatch against it anywhere. **Nothing whatever proved this
 * screen reacts to state changing underneath it.** Retiring the file would have removed the only
 * test in the repository asking that question of any merged screen.
 *
 * So the subject moved and the question did not. `WF-004` sits at stage `pulled`; `RELEASE_PULL`
 * moves it to `accepted_awaiting_bed`, and `DelayRow` renders `stageCopy[movement.stage].label` on
 * the row. A screen holding a record captured at mount would keep showing the old label — the same
 * failure the decision panel's badge showed on the screen this replaces.
 *
 * Both labels are read from `stageCopy`, never written in, and the case asserts they differ before
 * comparing anything — floored rather than escaped, because two equal labels would let a genuinely
 * stale screen pass.
 */

/** Raises a real `RELEASE_PULL` from a sibling of the screen, so the dispatch travels through the
 *  SAME provider the screen reads. Mirrors `PullReleaser` in ward-pull-vocabulary.dom.test.tsx.
 *  `pulled` is the only stage the reducer accepts this event at. */
function PullReleaser({ movementId }: { movementId: string }) {
  const { now, dispatch } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({ type: "RELEASE_PULL", role: "coordinator", now, movementId, reason: "pull_made_in_error" })
      }
    >
      release the pull
    </button>
  );
}

const SUBJECT = movementById("WF-004");

function rowFor(id: string): HTMLElement {
  const idNode = screen.getByText(id, { selector: "[data-ward-primitive='record-id']" });
  return idNode.closest("[data-ward-primitive='record-row']") as HTMLElement;
}

describe("the Delays screen reflects a dispatch made after mount, not the records it first rendered", () => {
  it("fixture precondition: WF-004 is pulled, and the two stage labels this turns on are different words", () => {
    expect(SUBJECT?.stage, "WF-004 is not at stage `pulled`, the only stage RELEASE_PULL is accepted at").toBe(
      "pulled",
    );
    /*
     * ⚠️ The anti-vacuity floor. If both stages rendered the same words, a screen that never
     * re-derived anything would pass the case below while doing precisely the thing it forbids.
     */
    expect(stageCopy.pulled.label).not.toBe(stageCopy.accepted_awaiting_bed.label);
  });

  it("moves WF-004's stage label when a released pull changes the record underneath it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen />
        <PullReleaser movementId="WF-004" />
      </WardFlowProvider>,
    );

    expect(rowFor("WF-004")).toHaveTextContent(stageCopy.pulled.label);

    fireEvent.click(screen.getByRole("button", { name: "release the pull" }));

    const row = rowFor("WF-004");
    expect(
      row,
      "WF-004's pull was released and its row still reads the stage it carried at mount — the screen " +
        "is rendering a record it captured rather than the live one",
    ).toHaveTextContent(stageCopy.accepted_awaiting_bed.label);
    expect(row).not.toHaveTextContent(stageCopy.pulled.label);
  });
});
