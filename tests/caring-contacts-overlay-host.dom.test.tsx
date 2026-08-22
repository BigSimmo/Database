import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { OverlayHost } from "@/components/caring-contacts/workspace/overlays/overlay-host";
import { WORKSPACE_OVERLAY_DEFINITIONS } from "@/components/caring-contacts/workspace/overlays/definitions";

/**
 * Task 18: one renderer, twenty-four overlays.
 *
 * The frozen definition table in `overlays/definitions.ts` is the authority for
 * modality and dismissal. Nothing here re-derives either value, and nothing here
 * hard-codes a per-overlay expectation: every expectation below is read off the
 * table, so a renderer that quietly substitutes its own idea of a modality goes
 * red naming the row rather than passing on a copy that agrees with itself.
 */

function noop() {}

/**
 * jsdom reports a fixed 1024px viewport. The host reads `window.innerWidth`
 * through the shared `widthStateFor` mapping, so a test width is set the same
 * way the browser would report one — the property, then the event that tells a
 * subscriber it moved.
 */
function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.dispatchEvent(new Event("resize"));
}

/**
 * A named trigger plus the host, so focus return can be asserted against the
 * control that actually opened the overlay rather than against whatever jsdom
 * happened to leave focused.
 */
function OverlayHarness({ overlayId }: { overlayId: string }) {
  const [openOverlayId, setOpenOverlayId] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpenOverlayId(overlayId)}>
        Open the overlay
      </button>
      <OverlayHost
        openOverlayId={openOverlayId}
        onClose={() => setOpenOverlayId(null)}
        onCommit={noop}
        blockReason={null}
      />
    </>
  );
}

describe("the overlay host", () => {
  it("renders every one of the 24 overlays with its frozen modality at both widths", () => {
    for (const definition of WORKSPACE_OVERLAY_DEFINITIONS) {
      for (const [width, expected] of [
        [390, definition.phoneModality],
        [1440, definition.desktopModality],
      ] as const) {
        setViewportWidth(width);
        const { unmount } = render(
          <OverlayHost openOverlayId={definition.id} onClose={noop} onCommit={noop} blockReason={null} />,
        );
        const body = screen.getByTestId("workspace-overlay-content");
        expect(body, `${definition.id} at ${width}px`).toHaveAttribute("data-overlay-id", definition.id);
        expect(body, `${definition.id} at ${width}px`).toHaveAttribute("data-overlay-modality", expected);
        expect(body, `${definition.id} at ${width}px`).toHaveAttribute("data-overlay-dismissal", definition.dismissal);
        unmount();
      }
    }
  });

  /**
   * The definition table's own copy is guarded in
   * `tests/caring-contacts-overlay-definitions.test.ts`. This covers the words
   * the RENDERER adds on top of it — the checkpoint note, the refusal sentence,
   * the confirm label — which that test cannot see.
   */
  it("adds no prohibited vocabulary of its own to what it renders", () => {
    const prohibited =
      /\bhigh risk\b|\bsafe\b|\bengagement scores?\b|\bcampaigns?\b|\bleads?\b|\bconversions?\b|\bbest match\b|\binbox(es)?\b|\bconversations?\b|\bclinical risk\b|\brisk scores?\b|\bwellbeing scores?\b|monitor(s|ed|ing)? (the )?repl(y|ies)|repl(y|ies) (are|is) monitored/i;

    for (const definition of WORKSPACE_OVERLAY_DEFINITIONS) {
      setViewportWidth(390);
      const { unmount } = render(
        <OverlayHost
          openOverlayId={definition.id}
          onClose={noop}
          onCommit={noop}
          blockReason="permission-unavailable"
        />,
      );
      const rendered = screen.getByTestId("workspace-overlay-content").textContent ?? "";
      expect(rendered, `${definition.id} renders prohibited wording`).not.toMatch(prohibited);
      unmount();
    }
  });

  it("returns focus to the control that opened the overlay", async () => {
    setViewportWidth(1440);
    render(<OverlayHarness overlayId="pause" />);
    const trigger = screen.getByRole("button", { name: /open the overlay/i });

    await userEvent.click(trigger);
    expect(screen.getByTestId("workspace-overlay-content")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("workspace-overlay-content")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps the session gate open through Escape", async () => {
    setViewportWidth(1440);
    const onClose = vi.fn();
    render(<OverlayHost openOverlayId="session-expiry" onClose={onClose} onCommit={noop} blockReason={null} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("workspace-overlay-content")).toBeInTheDocument();
  });

  it("never traps focus in the offline status banner", () => {
    setViewportWidth(1440);
    render(<OverlayHost openOverlayId="offline-banner" onClose={noop} onCommit={noop} blockReason={null} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("commits a withdrawal only on the second activation", async () => {
    setViewportWidth(1440);
    const onCommit = vi.fn();
    render(<OverlayHost openOverlayId="withdrawal" onClose={noop} onCommit={onCommit} blockReason={null} />);
    await userEvent.click(screen.getByRole("button", { name: /withdraw/i }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/fresh authentication checkpoint/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("blocks a mutating overlay with a named reason but leaves a read-only overlay usable", async () => {
    setViewportWidth(1440);
    const onCommit = vi.fn();
    render(
      <OverlayHost openOverlayId="pause" onClose={noop} onCommit={onCommit} blockReason="permission-unavailable" />,
    );
    const action = screen.getByRole("button", { name: /pause/i });
    expect(action).toHaveAttribute("aria-disabled", "true");
    expect(action).not.toHaveAttribute("disabled");
    expect(screen.getByText(/permission/i)).toBeInTheDocument();
    await userEvent.click(action);
    expect(onCommit).not.toHaveBeenCalled();

    cleanup();
    const readOnlyCommit = vi.fn();
    render(
      <OverlayHost
        openOverlayId="message-preview"
        onClose={noop}
        onCommit={readOnlyCommit}
        blockReason="permission-unavailable"
      />,
    );
    expect(screen.getByRole("button", { name: /close/i })).not.toHaveAttribute("aria-disabled");
    // The read-only overlay's own action stays live too, not merely its close control.
    const readOnlyAction = screen.getByRole("button", { name: /back to personalisation/i });
    expect(readOnlyAction).not.toHaveAttribute("aria-disabled");
    await userEvent.click(readOnlyAction);
    expect(readOnlyCommit).toHaveBeenCalledTimes(1);
  });
});
