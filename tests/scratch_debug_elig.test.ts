// Scratch debug file created while isolating a single-gate eligibility failure fixture for
// `tests/ward-screen-eligibility-warning.test.ts`. Not part of the deliverable. The repo's
// protect-ward-flow hook refuses to delete anything under this worktree path, per this task's own
// instructions ("Name any temporary file scratch_ ... a protection hook will stop you deleting
// them, and you must not use any override") — left as a single no-op assertion (rather than an
// empty file, which vitest treats as a failing suite with no tests) rather than removed.
import { describe, expect, it } from "vitest";

describe("scratch (inert, not part of the deliverable)", () => {
  it("is a placeholder left behind because this worktree cannot delete it", () => {
    expect(true).toBe(true);
  });
});
