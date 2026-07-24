import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Sheet } from "@/components/ui/sheet";

// jsdom (via vitest's environment) normally provides requestAnimationFrame, but
// guard it so the Sheet's focus scheduling never throws if a runner omits it.
beforeEach(() => {
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
  }
});

afterEach(() => {
  // Guard teardown: unhandled rAF/setTimeout from Sheet focus scheduling can
  // fire after Vitest tears down the jsdom environment under coverage workers.
  if (typeof document !== "undefined" && document.body) {
    document.body.style.overflow = "";
  }
});

function Stacked({
  openA,
  openB,
  onCloseA,
  onCloseB,
}: {
  openA: boolean;
  openB: boolean;
  onCloseA: () => void;
  onCloseB: () => void;
}) {
  return (
    <>
      <Sheet open={openA} onClose={onCloseA} title="Lower sheet" portal>
        <p>Lower body</p>
      </Sheet>
      <Sheet open={openB} onClose={onCloseB} title="Upper sheet" portal>
        <p>Upper body</p>
      </Sheet>
    </>
  );
}

function pressEscape() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
}

describe("Sheet stacked-overlay coordination", () => {
  it("routes Escape to only the top-most open Sheet", () => {
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();
    render(<Stacked openA openB onCloseA={onCloseA} onCloseB={onCloseB} />);

    pressEscape();

    expect(onCloseB).toHaveBeenCalledTimes(1);
    expect(onCloseA).not.toHaveBeenCalled();
  });

  it("keeps body scroll locked until the last Sheet closes, then restores the original overflow", () => {
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();
    const { rerender } = render(<Stacked openA openB onCloseA={onCloseA} onCloseB={onCloseB} />);

    // Both open → body scroll locked once.
    expect(document.body.style.overflow).toBe("hidden");

    // Close the upper (top) Sheet: the lower Sheet still holds the lock.
    rerender(<Stacked openA openB={false} onCloseA={onCloseA} onCloseB={onCloseB} />);
    expect(document.body.style.overflow).toBe("hidden");

    // After Escape now targets the lower Sheet (new top-most).
    pressEscape();
    expect(onCloseA).toHaveBeenCalledTimes(1);

    // Close the last Sheet: original overflow ("") is restored exactly once.
    rerender(<Stacked openA={false} openB={false} onCloseA={onCloseA} onCloseB={onCloseB} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("locks body scroll for a single Sheet and restores it on close (unchanged baseline)", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet open onClose={onClose} title="Solo" portal>
        <p>Solo body</p>
      </Sheet>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Sheet open={false} onClose={onClose} title="Solo" portal>
        <p>Solo body</p>
      </Sheet>,
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("cancels focus-restore timers on unmount so coverage teardown cannot throw", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { unmount } = render(
      <Sheet open onClose={onClose} title="Solo" portal>
        <p>Solo body</p>
      </Sheet>,
    );
    await vi.runAllTimersAsync();
    const restoreFrameSpy = vi.spyOn(window, "requestAnimationFrame");

    // Unmount while open: no restore callback should be scheduled after the
    // mount cleanup has started tearing down the component.
    unmount();
    expect(restoreFrameSpy).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
