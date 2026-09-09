import { describe, expect, it } from "vitest";

import { resolveMonotonicRevision } from "../scripts/generate-outstanding-issues-snapshot.mjs";

/**
 * `ledger_revision` in `data/outstanding-issues-snapshot.json` must never move
 * backwards. Regenerating from a stale base makes `git log` return an older
 * commit than the one already committed, and writing that over the recorded
 * value silently discards a newer pointer.
 *
 * That happened: commit `ca376969b` rolled the field from a 2026-08-25 revision
 * back to a 2026-08-22 one, and nothing detected it — it was found by accident
 * two days later while verifying an unrelated merge. Ledger `#BR2217`.
 *
 * These tests pin the guard AND its deliberate limits. Weakening the first case
 * reintroduces the regression; weakening the "unprovable" cases silently
 * changes behaviour for inputs the guard was never meant to judge.
 */
describe("ledger_revision is monotonic", () => {
  const older = { sha: "6085a0a59aca4c1bb9e19fb4d490fd34dec950cd", committed_at: "2026-08-22T20:52:39Z" };
  const newer = { sha: "707b965965a9b843c13deb6b5c9ddd158fe2631d", committed_at: "2026-08-25T17:45:01+00:00" };

  it("refuses a move that is provably backwards, keeping the committed revision", () => {
    // The exact shape of the ca376969b regression: a stale base offers an older
    // commit than the one already recorded.
    expect(resolveMonotonicRevision(older, newer)).toBe(newer);
  });

  it("accepts a move forwards", () => {
    expect(resolveMonotonicRevision(newer, older)).toBe(newer);
  });

  it("accepts an equal timestamp, so an unchanged regeneration is not a special case", () => {
    const sameInstant = { sha: "1111111111111111111111111111111111111111", committed_at: newer.committed_at };
    expect(resolveMonotonicRevision(sameInstant, newer)).toBe(sameInstant);
  });

  it("compares instants, not strings, so +00:00 and Z are the same moment", () => {
    // The regression also flipped `+00:00` to `Z`. A string comparison would
    // read these as different and could pick the wrong one.
    const zulu = { sha: "2222222222222222222222222222222222222222", committed_at: "2026-08-25T17:45:01Z" };
    const offset = { sha: "3333333333333333333333333333333333333333", committed_at: "2026-08-25T17:45:01+00:00" };
    expect(resolveMonotonicRevision(zulu, offset)).toBe(zulu);
    expect(resolveMonotonicRevision(offset, zulu)).toBe(offset);
  });

  describe("deliberately does not judge what it cannot prove", () => {
    it("keeps the committed revision when git cannot speak", () => {
      // The production image has no git repository; this path already existed
      // and must not change.
      expect(resolveMonotonicRevision(null, newer)).toBe(newer);
    });

    it("takes the git revision when there is no committed snapshot to preserve", () => {
      expect(resolveMonotonicRevision(newer, null)).toBe(newer);
    });

    it("returns null when neither side has anything", () => {
      expect(resolveMonotonicRevision(null, null)).toBeNull();
    });

    it("prefers the fresh git read when either timestamp is unparseable", () => {
      // An unprovable comparison must not change behaviour, in either direction.
      const nonsense = { sha: "4444444444444444444444444444444444444444", committed_at: "not-a-date" };
      expect(resolveMonotonicRevision(nonsense, newer)).toBe(nonsense);
      expect(resolveMonotonicRevision(newer, nonsense)).toBe(newer);
    });
  });
});
