import { afterEach, describe, expect, it } from "vitest";

import { prefersReducedMotion, resolveScrollBehavior } from "@/lib/scroll-behavior";

import { installMatchMediaStub } from "./setup/jsdom.setup";

describe("resolveScrollBehavior (jsdom)", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-motion");
    installMatchMediaStub(false);
  });

  it("resolves to smooth when no reduced-motion signal is present", () => {
    installMatchMediaStub(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(resolveScrollBehavior()).toBe("smooth");
  });

  it("resolves to auto when the OS prefers reduced motion", () => {
    installMatchMediaStub(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(resolveScrollBehavior()).toBe("auto");
  });

  it("resolves to auto when the in-app Reduce motion toggle is set, even if the OS is not", () => {
    installMatchMediaStub(false);
    document.documentElement.setAttribute("data-motion", "reduced");
    expect(prefersReducedMotion()).toBe(true);
    expect(resolveScrollBehavior()).toBe("auto");
  });
});
