import { describe, expect, it, vi } from "vitest";

import { authSessionFingerprint, createAuthRequestLifecycle } from "../src/lib/auth-request-lifecycle";

describe("auth request lifecycle", () => {
  it("changes for sign-in/account switches but stays stable across same-user token rotation", () => {
    expect(authSessionFingerprint("authenticated", "user-a")).toBe("authenticated:user-a");
    expect(authSessionFingerprint("authenticated", "user-a")).not.toBe(
      authSessionFingerprint("authenticated", "user-b"),
    );
    expect(authSessionFingerprint("authenticated", "user-a")).not.toBe(authSessionFingerprint("signed_out", null));
  });

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
