import { afterEach, describe, expect, it, vi } from "vitest";

import { restoreFocusUnlessMoved } from "../src/components/use-dismissable-layer";

describe("restoreFocusUnlessMoved (jsdom)", () => {
  afterEach(() => {
    document.getElementById("app-mode-menu")?.remove();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("restores focus when nothing else holds it", () => {
    const target = document.createElement("button");
    target.focus = vi.fn();
    document.body.append(target);

    expect(restoreFocusUnlessMoved(target)).toBe(true);
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("skips restore while the app-mode menu is open", () => {
    const menu = document.createElement("div");
    menu.id = "app-mode-menu";
    document.body.append(menu);

    const target = document.createElement("button");
    target.focus = vi.fn();
    document.body.append(target);

    expect(restoreFocusUnlessMoved(target)).toBe(false);
    expect(target.focus).not.toHaveBeenCalled();
  });

  it("skips restore when focus already moved to another control", () => {
    const target = document.createElement("button");
    target.focus = vi.fn();
    const other = document.createElement("button");
    other.setAttribute("aria-label", "Mode Answer");
    document.body.append(target, other);
    other.focus();

    expect(restoreFocusUnlessMoved(target)).toBe(false);
    expect(target.focus).not.toHaveBeenCalled();
  });
});
