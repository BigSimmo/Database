import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WORKSPACE_OVERLAY_DEFINITIONS } from "@/components/caring-contacts/workspace/overlays/definitions";
import {
  clearStagedWorkspaceOverlayCommit,
  commitForOpenOverlay,
  commitUnavailableReasonFor,
  NO_STAGED_COMMIT_REASON,
  readStagedWorkspaceOverlayCommit,
  stageWorkspaceOverlayCommit,
} from "@/components/caring-contacts/workspace/overlays/overlay-commits";
import { WorkspaceOverlayTrigger } from "@/components/caring-contacts/workspace/overlays/overlay-trigger";
import {
  openWorkspaceOverlay,
  WorkspaceOverlays,
} from "@/components/caring-contacts/workspace/overlays/workspace-overlays";

import { CARING_CONTACTS_PROHIBITED_LANGUAGE } from "./helpers/caring-contacts-prohibited-language";

/**
 * Task 3: the control that raises an overlay, and the commit contract that had to
 * ship with it.
 *
 * Ruling 87 is the whole reason this file is not simply "a button opens a panel".
 * The 24 overlays are decision surfaces, every one of them renders a confirm
 * control, and until this trigger existed none of them was reachable from any
 * control — which is the only reason a confirm that recorded nothing was
 * tolerable. So the assertions below come in two halves: the trigger opens what it
 * names, and NOTHING it opens offers a confirm control the system will not honour.
 */

/** jsdom reports a fixed 1024px viewport; the host needs a width to choose a modality at all. */
function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.dispatchEvent(new Event("resize"));
}

const WORKSPACE_PATH = "/caring-contacts";
/** A distinguishable prior entry, so what Back lands on is unambiguous. */
const PRIOR_PATH = "/caring-contacts/somewhere-before";

function seedHistory() {
  window.history.pushState(null, "", `${PRIOR_PATH}?marker=before`);
  window.history.pushState(null, "", WORKSPACE_PATH);
}

/**
 * The staged commit lives in a module-scoped slot, so it outlives a render the way
 * the browser tab does. Emptying it between tests is what stops one test's staged
 * intent silently satisfying the next test's assertion.
 */
beforeEach(() => {
  clearStagedWorkspaceOverlayCommit();
  setViewportWidth(1440);
  seedHistory();
});

afterEach(() => {
  cleanup();
  clearStagedWorkspaceOverlayCommit();
});

function contentFor(overlayId: string) {
  return document.querySelector(`[data-testid="workspace-overlay-content"][data-overlay-id="${overlayId}"]`);
}

describe("the overlay trigger", () => {
  it("opens the overlay it names, and Back closes it", async () => {
    render(
      <>
        <WorkspaceOverlayTrigger overlayId="pause" commit={{ kind: "record", record: () => {} }}>
          Pause this plan
        </WorkspaceOverlayTrigger>
        <WorkspaceOverlays />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Pause this plan" }));
    expect(contentFor("pause")).not.toBeNull();
    expect(window.location.search).toContain("overlay=pause");

    act(() => window.history.back());
    await waitFor(() => expect(contentFor("pause")).toBeNull());
    expect(window.location.search).not.toContain("overlay=");
  });

  it("fails loudly for an id the frozen table does not carry, rather than opening nothing", () => {
    // A control that opens an empty overlay is the silent version of exactly the
    // defect the commit contract exists to prevent, so it throws at render.
    expect(() =>
      render(
        <WorkspaceOverlayTrigger overlayId="pause-plan" commit={{ kind: "record", record: () => {} }}>
          Pause this plan
        </WorkspaceOverlayTrigger>,
      ),
    ).toThrow(/No overlay is defined for the id "pause-plan"/);
  });

  it("cannot be constructed without a commit", () => {
    // A type-level guarantee checked by `tsc --noEmit`, not at runtime: `commit`
    // is required, so a screen that opens an overlay it has not wired fails to
    // compile. `@ts-expect-error` fails the typecheck if the error ever stops
    // being raised — which is what makes this a proof rather than a comment.
    const withoutCommit = (
      // @ts-expect-error `commit` is required — an overlay cannot be opened unwired.
      <WorkspaceOverlayTrigger overlayId="pause">Pause this plan</WorkspaceOverlayTrigger>
    );
    expect(withoutCommit).toBeTruthy();
  });

  it("carries the workspace's 48px tap floor", () => {
    render(
      <WorkspaceOverlayTrigger overlayId="pause" commit={{ kind: "unavailable", reason: "Not built yet." }}>
        Pause this plan
      </WorkspaceOverlayTrigger>,
    );
    // `min-h-tap` is `--spacing-tap` (3rem). Never `min-h-11`: 44px reintroduces a
    // known `ui-smoke` sub-pixel flake.
    expect(screen.getByRole("button", { name: "Pause this plan" }).className).toContain("min-h-tap");
  });
});

describe("the commit contract", () => {
  it("records the screen's decision through the host mounted by the shell", async () => {
    const record = vi.fn();
    render(
      <>
        <WorkspaceOverlayTrigger overlayId="pause" commit={{ kind: "record", record }}>
          Pause this plan
        </WorkspaceOverlayTrigger>
        <WorkspaceOverlays />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Pause this plan" }));
    const action = screen.getByTestId("workspace-overlay-action");
    expect(action).not.toHaveAttribute("aria-disabled");

    await userEvent.click(action);
    // The overlay the trigger named, not whatever happened to be open.
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith("pause");

    await waitFor(() => expect(contentFor("pause")).toBeNull());
    // The intent is spent, so a forward traversal cannot re-enter it live.
    expect(readStagedWorkspaceOverlayCommit()).toBeNull();
  });

  it("still runs the fresh-authentication checkpoint before recording", async () => {
    const record = vi.fn();
    render(
      <>
        <WorkspaceOverlayTrigger overlayId="withdrawal" commit={{ kind: "record", record }}>
          Withdraw this patient
        </WorkspaceOverlayTrigger>
        <WorkspaceOverlays />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Withdraw this patient" }));
    await userEvent.click(screen.getByTestId("workspace-overlay-action"));
    expect(record, "the first activation raised the checkpoint; it must record nothing").not.toHaveBeenCalled();
    expect(screen.getByText(/fresh authentication checkpoint/i)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("workspace-overlay-action"));
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("refuses the decision in the aria-disabled shape when the caller states it is unavailable", async () => {
    const reason = "Pausing a plan is not built yet, so nothing can be changed from here.";
    render(
      <>
        <WorkspaceOverlayTrigger overlayId="pause" commit={{ kind: "unavailable", reason }}>
          Pause this plan
        </WorkspaceOverlayTrigger>
        <WorkspaceOverlays />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Pause this plan" }));
    const action = screen.getByTestId("workspace-overlay-action");

    expect(action).toHaveAttribute("aria-disabled", "true");
    // Never both: native `disabled` removes the tab stop, so the stated reason
    // could never be reached by keyboard, and lint fails on the pair.
    expect(action).not.toHaveAttribute("disabled");

    // Reachable, and NOT in a `title`: a title is reached by hover and may never
    // be announced at all.
    expect(action).not.toHaveAttribute("title");
    const describedBy = action.getAttribute("aria-describedby");
    expect(describedBy, "the refused control points at no reason").not.toBeNull();
    expect(document.getElementById(describedBy!)?.textContent).toBe(reason);

    await userEvent.click(action);
    expect(contentFor("pause"), "an inert action must not close the overlay either").not.toBeNull();
  });

  it("refuses a read-only overlay's action too when its decision is unwired", async () => {
    const readOnly = WORKSPACE_OVERLAY_DEFINITIONS.find((definition) => !definition.mutatesState);
    expect(readOnly, "the frozen table carries at least one read-only row").toBeDefined();
    const reason = "This preview is not wired to a screen yet.";
    render(
      <>
        <WorkspaceOverlayTrigger overlayId={readOnly!.id} commit={{ kind: "unavailable", reason }}>
          Open the preview
        </WorkspaceOverlayTrigger>
        <WorkspaceOverlays />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open the preview" }));
    // A permission refusal deliberately leaves a read-only overlay usable; an
    // UNWIRED decision must not, because its action is just as dead as a mutating
    // row's would be.
    expect(screen.getByTestId("workspace-overlay-action")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(reason)).toBeInTheDocument();
  });

  it("refuses an overlay reached by address rather than from a control", async () => {
    render(<WorkspaceOverlays />);
    act(() => openWorkspaceOverlay("pause"));
    await screen.findByTestId("workspace-overlay-content");

    const action = screen.getByTestId("workspace-overlay-action");
    expect(action).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(NO_STAGED_COMMIT_REASON)).toBeInTheDocument();
  });

  it("never offers one overlay's staged commit to another", () => {
    const commit = { kind: "record", record: () => {} } as const;
    stageWorkspaceOverlayCommit("pause", commit);
    const slot = readStagedWorkspaceOverlayCommit();

    expect(commitForOpenOverlay(slot, "pause")).toBe(commit);
    // The identity check is the safeguard, not a formality: a slot left over from
    // one overlay must never satisfy a different one.
    expect(commitForOpenOverlay(slot, "withdrawal")).toBeNull();
    expect(commitForOpenOverlay(slot, null)).toBeNull();
    expect(commitForOpenOverlay(null, "pause")).toBeNull();
  });

  it("answers every state of the slot, and refuses in two of the three", () => {
    // Total by construction, so the rule can be read here rather than inferred
    // from a rendered button.
    expect(commitUnavailableReasonFor(null)).toBe(NO_STAGED_COMMIT_REASON);
    expect(commitUnavailableReasonFor({ kind: "unavailable", reason: "Not built yet." })).toBe("Not built yet.");
    expect(commitUnavailableReasonFor({ kind: "record", record: () => {} })).toBeNull();
  });

  it("states the unstaged refusal in permitted vocabulary", () => {
    expect(NO_STAGED_COMMIT_REASON).not.toMatch(CARING_CONTACTS_PROHIBITED_LANGUAGE);
  });
});
