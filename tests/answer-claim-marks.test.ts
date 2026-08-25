import { describe, expect, it } from "vitest";

import { claimMarkCoverage, maxMarksPerCluster, normalizeClaimText, resolveClaimMarks } from "@/lib/answer-claim-marks";
import type { SupportedClaim } from "@/lib/types";

/**
 * The numbers in the answer prose are an attribution claim, so every rule here
 * fails in the same direction: when the mechanism is unsure, it renders nothing
 * and the source rail below stays the route to every document.
 *
 * These cases are the boundary of "unsure". A number that points at a page not
 * stating the claim is worse than no number at all, which is why none of them
 * are similarity thresholds that could be nudged later to raise coverage.
 */

function claim(overrides: Partial<SupportedClaim> & { claimId: string; text: string }): SupportedClaim {
  return {
    riskClass: "routine",
    supportingChunkIds: ["chunk-a"],
    supportStatus: "direct",
    ...overrides,
  };
}

const SOURCE_IDS = ["chunk-a", "chunk-b", "chunk-c"];

function fragments(...texts: string[]) {
  return texts.map((text) => ({ text }));
}

describe("normalizeClaimText", () => {
  it("brings the display and server forms of one sentence to the same shape", () => {
    // The server strips markdown emphasis and collapses whitespace; the display
    // path also strips list markers. Both land here.
    expect(normalizeClaimText("Check **FBC** weekly.")).toBe("check fbc weekly");
    expect(normalizeClaimText("Check FBC   weekly")).toBe("check fbc weekly");
  });

  it("absorbs the separators splitClaims consumes", () => {
    // `splitClaims` cuts at `;` and drops it, so a rejoined pair has to compare
    // equal to the sentence it came from.
    expect(normalizeClaimText("Start lithium; monitor levels")).toBe(
      `${normalizeClaimText("Start lithium")} ${normalizeClaimText("monitor levels")}`,
    );
  });
});

describe("resolveClaimMarks", () => {
  it("marks a sentence that is exactly one directly supported claim", () => {
    const [cluster] = resolveClaimMarks({
      fragments: fragments("Check FBC weekly."),
      claims: [claim({ claimId: "claim-1", text: "Check FBC weekly", supportingChunkIds: ["chunk-b"] })],
      sourceIds: SOURCE_IDS,
    });
    expect(cluster).toEqual({
      claimId: "claim-1",
      support: "direct",
      marks: [{ index: 1, sourceId: "chunk-b" }],
      overflow: 0,
    });
  });

  it("renders a partially supported claim as a partial mark, never a plain one", () => {
    const [cluster] = resolveClaimMarks({
      fragments: fragments("Titrate slowly in renal impairment."),
      claims: [claim({ claimId: "claim-1", text: "Titrate slowly in renal impairment", supportStatus: "partial" })],
      sourceIds: SOURCE_IDS,
    });
    expect(cluster?.support).toBe("partial");
  });

  it("renders nothing for an unsupported claim", () => {
    // The owner removed the worded in-text "no source" tag during design review.
    // Silence plus the rail is the degrade, not a second kind of label.
    expect(
      resolveClaimMarks({
        fragments: fragments("Consider a mood stabiliser."),
        claims: [claim({ claimId: "claim-1", text: "Consider a mood stabiliser", supportStatus: "unsupported" })],
        sourceIds: SOURCE_IDS,
      }),
    ).toEqual([null]);
  });

  it("drops a citation the rail does not list rather than renumbering it", () => {
    expect(
      resolveClaimMarks({
        fragments: fragments("Check FBC weekly."),
        claims: [claim({ claimId: "claim-1", text: "Check FBC weekly", supportingChunkIds: ["chunk-zzz"] })],
        sourceIds: SOURCE_IDS,
      }),
    ).toEqual([null]);
  });

  it("caps a cluster and counts the rest", () => {
    const [cluster] = resolveClaimMarks({
      fragments: fragments("Check FBC weekly."),
      claims: [claim({ claimId: "claim-1", text: "Check FBC weekly", supportingChunkIds: SOURCE_IDS })],
      sourceIds: SOURCE_IDS,
    });
    expect(cluster?.marks).toHaveLength(maxMarksPerCluster);
    expect(cluster?.overflow).toBe(1);
  });

  it("merges consecutive claims only when every one of them is direct", () => {
    const both = resolveClaimMarks({
      fragments: fragments("Start lithium; monitor levels weekly."),
      claims: [
        claim({ claimId: "claim-1", text: "Start lithium", supportingChunkIds: ["chunk-a"] }),
        claim({ claimId: "claim-2", text: "monitor levels weekly", supportingChunkIds: ["chunk-b"] }),
      ],
      sourceIds: SOURCE_IDS,
    });
    expect(both[0]?.marks.map((mark) => mark.index)).toEqual([0, 1]);

    // The same sentence, but the second half is only partly supported: the first
    // half's plain number must not be inherited by the whole sentence.
    expect(
      resolveClaimMarks({
        fragments: fragments("Start lithium; monitor levels weekly."),
        claims: [
          claim({ claimId: "claim-1", text: "Start lithium", supportingChunkIds: ["chunk-a"] }),
          claim({
            claimId: "claim-2",
            text: "monitor levels weekly",
            supportingChunkIds: ["chunk-b"],
            supportStatus: "partial",
          }),
        ],
        sourceIds: SOURCE_IDS,
      }),
    ).toEqual([null]);
  });

  it("renders nothing when two claims disagree about the same sentence", () => {
    // The same sentence can be recorded twice — once at the top level and once
    // inside a section. Agreeing entries are one attribution; disagreeing ones
    // are a conflict this surface must not silently pick a winner from.
    expect(
      resolveClaimMarks({
        fragments: fragments("Check FBC weekly."),
        claims: [
          claim({ claimId: "claim-1", text: "Check FBC weekly", supportingChunkIds: ["chunk-a"] }),
          claim({ claimId: "claim-9", text: "Check FBC weekly", supportingChunkIds: ["chunk-c"] }),
        ],
        sourceIds: SOURCE_IDS,
      }),
    ).toEqual([null]);
  });

  it("accepts a duplicate recording that says the same thing", () => {
    const [cluster] = resolveClaimMarks({
      fragments: fragments("Check FBC weekly."),
      claims: [
        claim({ claimId: "claim-1", text: "Check FBC weekly" }),
        claim({ claimId: "claim-4", text: "Check FBC weekly" }),
      ],
      sourceIds: SOURCE_IDS,
    });
    expect(cluster?.marks).toEqual([{ index: 0, sourceId: "chunk-a" }]);
  });

  it("never marks a sentence the word budget cut short", () => {
    expect(
      resolveClaimMarks({
        fragments: [{ text: "Check FBC weekly", truncated: true }],
        claims: [claim({ claimId: "claim-1", text: "Check FBC weekly" })],
        sourceIds: SOURCE_IDS,
      }),
    ).toEqual([null]);
  });

  it("returns one null per sentence when the answer carries no assessed claims", () => {
    // Every fallback and degraded path reaches the surface this way. It must
    // render prose without marks and without throwing.
    const clusters = resolveClaimMarks({
      fragments: fragments("One.", "Two.", "Three."),
      claims: [],
      sourceIds: SOURCE_IDS,
    });
    expect(clusters).toEqual([null, null, null]);
    expect(claimMarkCoverage(clusters)).toEqual({ marked: 0, total: 3 });
  });

  it("never renumbers around a row a mark may not point at", () => {
    // The caller masks an uncited rail card to an empty id instead of dropping
    // it. Dropping would shift every later card's number, which is the silent
    // wrong-page attribution this whole surface exists to prevent.
    const [cluster] = resolveClaimMarks({
      fragments: fragments("Check FBC weekly."),
      claims: [claim({ claimId: "claim-1", text: "Check FBC weekly", supportingChunkIds: ["chunk-c"] })],
      sourceIds: ["chunk-a", "", "chunk-c"],
    });
    expect(cluster?.marks).toEqual([{ index: 2, sourceId: "chunk-c" }]);

    expect(
      resolveClaimMarks({
        fragments: fragments("Check FBC weekly."),
        claims: [claim({ claimId: "claim-1", text: "Check FBC weekly", supportingChunkIds: ["chunk-b"] })],
        sourceIds: ["chunk-a", "", "chunk-c"],
      }),
    ).toEqual([null]);
  });

  it("returns one null per sentence when there are no cited sources to point at", () => {
    expect(
      resolveClaimMarks({
        fragments: fragments("Check FBC weekly."),
        claims: [claim({ claimId: "claim-1", text: "Check FBC weekly" })],
        sourceIds: ["", ""],
      }),
    ).toEqual([null]);
  });
});
