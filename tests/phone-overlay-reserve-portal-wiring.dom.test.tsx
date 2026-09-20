/**
 * Does a portal actually REACH the immediate publisher, and when?
 *
 * `tests/phone-overlay-chrome-reserve.dom.test.ts` calls
 * `publishPhoneOverlayChromeReserveNow()` by hand, so it proves what the
 * function does once invoked and nothing at all about who invokes it. Both
 * `useLayoutEffect` blocks that call it could be deleted outright and every
 * case in that file would still pass. This file closes that hole by mounting
 * the real hook and a real portal together and asserting the reserve after the
 * commit — which is also how the scope limit below was found (adversarial
 * review of PR #2929).
 *
 * THE SCOPE LIMIT, PINNED HERE ON PURPOSE. React runs layout effects
 * children-first. The reserve hook belongs to the shell (`GlobalSearchShell`)
 * and both portals are its descendants, so on a FIRST mount the portal's effect
 * runs before the shell's hook effect has started — long before the hook's 80ms
 * geometry quiet window has settled anything. `publishPhoneOverlayChromeReserveNow`
 * refuses to publish before that settle (it must: on a cold load responsive
 * layout can still be reporting the wide 200px stack, #147). So on a cold load
 * the immediate publish never fires and the quiet window alone corrects the
 * reserve, exactly as it did before PR #2929.
 *
 * What the fix does cover is every subsequent in-session navigation, where the
 * shell stays mounted and settled — which is most Differentials navigation, but
 * NOT the cold `page.goto` that #CHPC5C recorded. That case is still open. The
 * cold assertion below exists so nobody can quietly come to believe otherwise;
 * when it is genuinely fixed, that test flips and says so.
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { PhoneHeaderCollapsePortal } from "@/components/clinical-dashboard/phone-header-collapse-portal";
import {
  __setPhoneOverlayReserveSettledForTests,
  phoneOverlayReserveGeometryQuietWindowMs,
  usePhoneOverlayChromeReserve,
} from "@/components/clinical-dashboard/use-phone-overlay-chrome-reserve";
import { phoneHeaderCollapseAddonSlotId } from "@/lib/mode-home-composer";

const baseStackPx = 72;
const addonRowPx = 49;

// These cases drive `createRoot` directly rather than through Testing Library,
// because the subject IS commit ordering and a render helper that flushes for
// you would hide it.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pendingFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;

function installPhoneStubs() {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const frameId = nextFrameId++;
    pendingFrames.set(frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (frameId: number) => {
    pendingFrames.delete(frameId);
  });
}

/**
 * The header stack, measuring itself the way the browser does: taller by one
 * addon row exactly while the slot is occupied. That coupling is the whole
 * subject — the reserve has to change in the commit that changes occupancy.
 */
function mountChrome() {
  document.body.innerHTML = `
    <div class="phone-sticky-header-stack">
      <div data-testid="universal-header-collapse">
        <div id="${phoneHeaderCollapseAddonSlotId}"></div>
      </div>
    </div>
    <div id="app-root"></div>
  `;
  const stack = document.querySelector<HTMLElement>(".phone-sticky-header-stack")!;
  const collapse = document.querySelector<HTMLElement>('[data-testid="universal-header-collapse"]')!;
  const slot = document.getElementById(phoneHeaderCollapseAddonSlotId)!;
  const measure = () => baseStackPx + (slot.childElementCount > 0 ? addonRowPx : 0);
  Object.defineProperty(stack, "offsetHeight", { configurable: true, get: measure });
  Object.defineProperty(collapse, "offsetHeight", { configurable: true, get: measure });
  return { slot, container: document.getElementById("app-root")! };
}

function Shell({ children }: { children: ReactNode }) {
  usePhoneOverlayChromeReserve();
  return <>{children}</>;
}

const reserve = () => document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h");

/** Runs whatever frames the hook has queued, at the timestamps given. */
function flushFrames(timestamps: number[]) {
  for (const timestamp of timestamps) {
    const entry = pendingFrames.entries().next().value as [number, FrameRequestCallback] | undefined;
    if (!entry) return;
    pendingFrames.delete(entry[0]);
    act(() => {
      entry[1](timestamp);
    });
  }
}

describe("portal wiring into the immediate reserve publisher", () => {
  beforeEach(() => {
    pendingFrames.clear();
    nextFrameId = 1;
    __setPhoneOverlayReserveSettledForTests(false);
    installPhoneStubs();
  });

  afterEach(() => {
    __setPhoneOverlayReserveSettledForTests(false);
    document.documentElement.style.removeProperty("--phone-overlay-chrome-h");
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("grows the reserve in the same commit the row leaves flow, once the shell has settled", () => {
    const { slot, container } = mountChrome();
    const root = createRoot(container);

    // The shell mounts first and its quiet window settles the bare 72px stack —
    // an in-session navigation, not a cold load.
    act(() => {
      root.render(<Shell>{null}</Shell>);
    });
    flushFrames([0, phoneOverlayReserveGeometryQuietWindowMs + 1]);
    expect(reserve()).toBe(`${baseStackPx}px`);

    // Now the route with the nav row arrives. The row leaves page flow in this
    // commit, so the reserve must be 121px by the end of it — with no frame run
    // in between, which is what the absent `flushFrames` call below asserts.
    act(() => {
      root.render(
        <Shell>
          <PhoneHeaderCollapsePortal>
            <nav data-testid="mode-nav-row">nav</nav>
          </PhoneHeaderCollapsePortal>
        </Shell>,
      );
    });
    expect(slot.childElementCount).toBe(1);
    expect(reserve()).toBe(`${baseStackPx + addonRowPx}px`);

    act(() => {
      root.unmount();
    });
  });

  it("KNOWN GAP: unmounting the portal leaves the reserve too large", () => {
    // The mirror of the defect — content held 49px too LOW instead of too high,
    // the same tap-retarget class — and it is NOT wired, despite the comment on
    // the effect and the name of a case in the sibling test file both implying
    // it is. The effect has a `[host]` dependency and no cleanup, so nothing at
    // all runs when the component goes away.
    //
    // Two repairs were tried and neither works. A cleanup that publishes
    // directly measures 121px, because React runs layout-effect destroys before
    // it detaches the portal's children from the slot. Deferring that publish
    // to a microtask does measure the right DOM and does land before paint, but
    // it is then no longer "the same commit", which is the only guarantee this
    // whole mechanism rests on. Doing it properly means the portal publishing
    // its own height as a delta rather than re-measuring the stack — a real
    // change to shared phone chrome, not a patch.
    const { slot, container } = mountChrome();
    const root = createRoot(container);

    act(() => {
      root.render(<Shell>{null}</Shell>);
    });
    flushFrames([0, phoneOverlayReserveGeometryQuietWindowMs + 1]);
    act(() => {
      root.render(
        <Shell>
          <PhoneHeaderCollapsePortal>
            <nav>nav</nav>
          </PhoneHeaderCollapsePortal>
        </Shell>,
      );
    });
    expect(reserve()).toBe(`${baseStackPx + addonRowPx}px`);

    act(() => {
      root.render(<Shell>{null}</Shell>);
    });
    // The row is back in page flow...
    expect(slot.childElementCount).toBe(0);
    // ...and the reserve still claims the taller stack.
    expect(reserve()).toBe(`${baseStackPx + addonRowPx}px`);

    act(() => {
      root.unmount();
    });
  });

  it("KNOWN GAP: a cold first mount is still corrected only by the quiet window", () => {
    // Not an aspiration — a pin on current behaviour. Layout effects run
    // children-first, so the portal publishes before the shell's hook exists,
    // and the publisher's pre-settle guard (#147) correctly refuses it. The
    // reserve is therefore still wrong for the whole quiet window on the exact
    // path #CHPC5C recorded: a cold `page.goto` on a Differentials phone route.
    //
    // When that is fixed, this test fails — and it should. Change it then, with
    // the fix, rather than before it.
    const { slot, container } = mountChrome();
    const root = createRoot(container);

    act(() => {
      root.render(
        <Shell>
          <PhoneHeaderCollapsePortal>
            <nav>nav</nav>
          </PhoneHeaderCollapsePortal>
        </Shell>,
      );
    });

    // The row HAS left page flow — the page is already 49px short.
    expect(slot.childElementCount).toBe(1);
    // ...and the reserve has not moved off the CSS seed to compensate.
    expect(reserve()).toBe("");

    // It takes the quiet window to correct, and twice over: the hook's first
    // candidate is the 72px it measured before the portal's own re-render moved
    // the row, so the frame that sees 121px has to re-stage it from scratch.
    flushFrames([0, phoneOverlayReserveGeometryQuietWindowMs + 1]);
    expect(reserve()).toBe("");
    flushFrames([2 * (phoneOverlayReserveGeometryQuietWindowMs + 1)]);
    expect(reserve()).toBe(`${baseStackPx + addonRowPx}px`);

    act(() => {
      root.unmount();
    });
  });
});
