import { describe, expect, it } from "vitest";

import { PULL_RELEASE_REASONS } from "../src/components/ward-management/ward-admissions";

/**
 * ⚠️ THIS LIST HAS NO CONSUMER YET, WHICH IS PRECISELY WHY IT NEEDS A PIN.
 *
 * Nothing on `Admission` carries a `PullReleaseReason` today — the vocabulary is defined ahead of
 * the release event so that event has one list to draw from rather than inventing a second. That
 * absence cuts both ways: striking an entry breaks nothing visible, and RESTORING one would break
 * nothing visible either. Without an assertion, the owner's ruling would be a fact about a single
 * afternoon rather than a property of the code.
 *
 * ⚠️ THE RULING, 2026-09-03: "Placed elsewhere" is struck. A pull is released because THIS
 * admission is not happening. Where the person went instead is a different fact on a different
 * record, and offering it as a release reason invites a ward to write another unit's business into
 * its own note — the same shape as the withdrawal-record privacy rule.
 */
describe("PULL_RELEASE_REASONS", () => {
  it("does not offer 'Placed elsewhere', struck by the owner", () => {
    expect(PULL_RELEASE_REASONS).not.toContain("Placed elsewhere");
  });

  // ⚠️ ANTI-VACUITY, and it is doing real work here: `not.toContain` is satisfied by an EMPTY list,
  // by a renamed export, and by a list that lost every entry to an unrelated edit. Naming the
  // survivors means the assertion above can only pass for the intended reason.
  it("still offers the four that remain, named rather than counted", () => {
    expect(PULL_RELEASE_REASONS).toEqual([
      "Clinical condition changed",
      "Transport unavailable",
      "Admission declined",
      "Pulled in error",
    ]);
  });
});
