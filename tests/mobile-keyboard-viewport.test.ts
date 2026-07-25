import { describe, expect, it } from "vitest";

import { resolveMobileKeyboardBaselines, resolveMobileKeyboardViewport } from "@/components/use-mobile-keyboard";

describe("resolveMobileKeyboardViewport", () => {
  it("does not double-lift chrome when both layout and visual viewports resize", () => {
    expect(
      resolveMobileKeyboardViewport({
        maxVisualHeight: 800,
        currentVisualHeight: 500,
        maxLayoutHeight: 800,
        currentLayoutHeight: 500,
        hasEditableFocus: true,
      }),
    ).toEqual({ isKeyboardOpen: true, keyboardHeight: 0 });
  });

  it("reports the keyboard lift when only the visual viewport shrinks", () => {
    expect(
      resolveMobileKeyboardViewport({
        maxVisualHeight: 800,
        currentVisualHeight: 500,
        maxLayoutHeight: 800,
        currentLayoutHeight: 800,
        hasEditableFocus: true,
      }),
    ).toEqual({ isKeyboardOpen: true, keyboardHeight: 300 });
  });

  it("ignores ordinary viewport jitter", () => {
    expect(
      resolveMobileKeyboardViewport({
        maxVisualHeight: 800,
        currentVisualHeight: 720,
        maxLayoutHeight: 800,
        currentLayoutHeight: 800,
        hasEditableFocus: true,
      }),
    ).toEqual({ isKeyboardOpen: false, keyboardHeight: 0 });
  });

  it("ignores viewport shrink without an editable focus target", () => {
    expect(
      resolveMobileKeyboardViewport({
        maxVisualHeight: 800,
        currentVisualHeight: 500,
        maxLayoutHeight: 800,
        currentLayoutHeight: 800,
        hasEditableFocus: false,
      }),
    ).toEqual({ isKeyboardOpen: false, keyboardHeight: 0 });
  });
});

describe("resolveMobileKeyboardBaselines", () => {
  it("rebases to the current viewport when orientation changes without a keyboard", () => {
    expect(
      resolveMobileKeyboardBaselines({
        widthChanged: true,
        hasEditableFocus: false,
        keyboardWasOpen: false,
        pendingOrientationRebase: false,
        currentVisualHeight: 390,
        currentLayoutHeight: 390,
        previousVisualHeight: 800,
        previousLayoutHeight: 800,
        maxVisualHeight: 800,
        maxLayoutHeight: 800,
      }),
    ).toEqual({
      maxVisualHeight: 390,
      maxLayoutHeight: 390,
      pendingOrientationRebase: false,
      deferredOccludedVisualHeight: null,
    });
  });

  it("preserves keyboard lift when rotating with an overlay keyboard open", () => {
    // Portrait: max 800, occluded visual 500 (300px keyboard).
    // Landscape resize observes an already-occluded 350 visual height.
    // Resetting baselines to 350 would compute zero occlusion and drop the dock.
    const deferred = resolveMobileKeyboardBaselines({
      widthChanged: true,
      hasEditableFocus: true,
      keyboardWasOpen: true,
      pendingOrientationRebase: false,
      currentVisualHeight: 350,
      currentLayoutHeight: 800,
      previousVisualHeight: 500,
      previousLayoutHeight: 800,
      maxVisualHeight: 800,
      maxLayoutHeight: 800,
    });

    expect(deferred).toEqual({
      maxVisualHeight: 650,
      maxLayoutHeight: 800,
      pendingOrientationRebase: true,
      deferredOccludedVisualHeight: 350,
    });

    expect(
      resolveMobileKeyboardViewport({
        maxVisualHeight: deferred.maxVisualHeight,
        currentVisualHeight: 350,
        maxLayoutHeight: deferred.maxLayoutHeight,
        currentLayoutHeight: 800,
        hasEditableFocus: true,
      }),
    ).toEqual({ isKeyboardOpen: true, keyboardHeight: 300 });
  });

  it("restores a stored orientation baseline when rotating with the keyboard open", () => {
    const restored = resolveMobileKeyboardBaselines({
      widthChanged: true,
      hasEditableFocus: true,
      keyboardWasOpen: true,
      pendingOrientationRebase: false,
      currentVisualHeight: 200,
      currentLayoutHeight: 400,
      previousVisualHeight: 500,
      previousLayoutHeight: 800,
      maxVisualHeight: 800,
      maxLayoutHeight: 800,
      storedBaseline: { maxVisualHeight: 400, maxLayoutHeight: 400 },
    });

    expect(restored).toEqual({
      maxVisualHeight: 400,
      maxLayoutHeight: 400,
      pendingOrientationRebase: false,
      deferredOccludedVisualHeight: null,
    });

    expect(
      resolveMobileKeyboardViewport({
        maxVisualHeight: restored.maxVisualHeight,
        currentVisualHeight: 200,
        maxLayoutHeight: restored.maxLayoutHeight,
        currentLayoutHeight: 400,
        hasEditableFocus: true,
      }),
    ).toEqual({ isKeyboardOpen: true, keyboardHeight: 200 });
  });

  it("finishes a deferred orientation rebase once the keyboard closes", () => {
    expect(
      resolveMobileKeyboardBaselines({
        widthChanged: false,
        hasEditableFocus: true,
        keyboardWasOpen: true,
        pendingOrientationRebase: true,
        currentVisualHeight: 400,
        currentLayoutHeight: 400,
        previousVisualHeight: 350,
        previousLayoutHeight: 800,
        maxVisualHeight: 650,
        maxLayoutHeight: 800,
        deferredOccludedVisualHeight: 350,
      }),
    ).toEqual({
      maxVisualHeight: 400,
      maxLayoutHeight: 400,
      pendingOrientationRebase: false,
      deferredOccludedVisualHeight: null,
    });
  });
});
