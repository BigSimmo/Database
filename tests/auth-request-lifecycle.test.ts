import { describe, expect, it, vi } from "vitest";

import { createAuthRequestLifecycle } from "../src/lib/auth-request-lifecycle";

describe("auth request lifecycle", () => {
  it("aborts registered work and rejects commits from the previous epoch", () => {
    const lifecycle = createAuthRequestLifecycle(4);
    const controller = new AbortController();
    const abort = vi.spyOn(controller, "abort");
    const registration = lifecycle.register(controller);

    expect(registration.epoch).toBe(4);
    expect(lifecycle.isCurrent(registration.epoch)).toBe(true);

    expect(lifecycle.invalidate()).toBe(5);
    expect(abort).toHaveBeenCalledOnce();
    expect(lifecycle.isCurrent(registration.epoch)).toBe(false);
  });

  it("does not abort released work", () => {
    const lifecycle = createAuthRequestLifecycle();
    const controller = new AbortController();
    const abort = vi.spyOn(controller, "abort");
    lifecycle.register(controller).release();

    lifecycle.invalidate();

    expect(abort).not.toHaveBeenCalled();
  });
});
