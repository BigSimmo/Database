import { describe, expect, it } from "vitest";

import { resolveMobileKeyboardViewport } from "@/components/use-mobile-keyboard";

describe("resolveMobileKeyboardViewport", () => {
  it("does not double-lift chrome when both layout and visual viewports resize", () => {
    expect(
      resolveMobileKeyboardViewport({
        maxVisualHeight: 800,
        currentVisualHeight: 500,
        maxLayoutHeight: 800,
        currentLayoutHeight: 500,
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
      }),
    ).toEqual({ isKeyboardOpen: false, keyboardHeight: 0 });
  });
});
