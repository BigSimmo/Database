import { describe, it } from "vitest";

/**
 * SCRATCH — NOT COVERAGE, AND SAFE TO DELETE.
 *
 * A one-off probe that printed each seeded referral's state and both clocks, to measure the
 * `referralWaitLabel` defect rather than infer it. It is what established that `RF-003` is the only
 * referral whose clock should stop AND that it is `accepted`, so the network queue never shows it —
 * which corrected the claim I was about to commit.
 *
 * Superseded by `ward-network-referral-clocks.dom.test.tsx`. Emptied rather than deleted because
 * the workstation's protected-work hook refuses deletions anywhere in this tree; it cannot tell a
 * scratch file from a live worktree, and working around a guard that exists because worktrees have
 * twice been destroyed here is not worth tidying one file for.
 */
describe.skip("referral clock probe (scratch)", () => {
  it("is not a test", () => {});
});
