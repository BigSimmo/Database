/**
 * Which cited source, if any, a sentence of the answer prose is allowed to point
 * at — the data behind the small numbered marks in the answer.
 *
 * The design brief assumed marks would come from `answer.answerSections`. They
 * cannot: `answerSections` is a *second layer* of structured support written
 * alongside the prose ("Second-layer structured support…" in the generation
 * schema), so a section's body is not the text the clinician reads.
 *
 * `RagAnswer.supportedClaims` is. Its top-level entries are built server-side by
 * splitting `answer.answer` itself, and each carries the chunk ids that support
 * it plus a `supportStatus`. So a mark here restates an attribution the answer
 * pipeline already made, rather than re-deriving one by matching prose against
 * retrieved chunks after the fact — the failure mode ledger `#VXB8XA` tracks and
 * the redesign brief forbids.
 *
 * Everything below is exact. There is no similarity scoring and no threshold: a
 * sentence either *is* a recorded claim or it carries no mark. Ambiguity always
 * resolves to no mark, because a number pointing at a page that does not state
 * the claim is worse than no number at all.
 */
import type { SupportedClaim } from "@/lib/types";

/** One number in a cluster: the rail row it opens, and the source it points at. */
export type ClaimMarkTarget = {
  /** Index of the rail row / drawer page this mark opens. */
  index: number;
  /** The cited chunk id, kept so a test can prove the mark points where the claim says. */
  sourceId: string;
};

export type ClaimMarkCluster = {
  /** `SupportedClaim.claimId` of the claim that earned the cluster (the first, when merged). */
  claimId: string;
  /**
   * `direct` renders a plain number. `partial` renders the number plus one
   * trailing glyph — a dotted underline and a 1px bottom border were both tried
   * under a superscript this small and neither draws.
   *
   * `unsupported` never reaches here: it produces no cluster at all. The owner
   * removed the worded "related" / "no source" in-text tags during design
   * review, so an unsupported sentence is simply unmarked and the rail below
   * stays the route to every source.
   */
  support: "direct" | "partial";
  /** Capped at {@link maxMarksPerCluster}; the rest are counted in `overflow`. */
  marks: ClaimMarkTarget[];
  /** How many further sources this claim cites beyond the cap. */
  overflow: number;
};

/**
 * A claim on four documents would otherwise produce an unbreakable run wider
 * than a phone column, so a cluster shows two numbers and a `+N`.
 */
export const maxMarksPerCluster = 2;

/**
 * Canonical form for comparing a rendered sentence against a recorded claim.
 *
 * Both sides go through this one function, so the comparison stays exact even
 * though the two texts took different routes to the screen: `splitClaims`
 * (server) strips `*_`#` and collapses whitespace, while the display path also
 * strips list markers and section labels. Collapsing every non-alphanumeric run
 * to a single space additionally makes the two agree across the separators
 * `splitClaims` consumes — it splits on `;` and on "and"/"then" before a
 * clinical verb, and drops the separator, so the claim texts rejoin without it.
 */
export function normalizeClaimText(value: string) {
  return value
    .replace(/[*_`#]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** One sentence of the answer as it was split for display, before mark resolution. */
export type ClaimMarkFragment = {
  /**
   * The fragment as the display splitter produced it, *before* the prose
   * usefulness pass rewrote it — the same text the server split claims from.
   */
  text: string;
  /**
   * True when the word budget cut this fragment short. A truncated sentence is
   * not the claim, so it never earns a mark.
   */
  truncated?: boolean;
};

type NormalizedClaim = {
  claim: SupportedClaim;
  normalized: string;
};

function claimsAreEquivalent(a: SupportedClaim, b: SupportedClaim) {
  return (
    a.supportStatus === b.supportStatus &&
    a.supportingChunkIds.length === b.supportingChunkIds.length &&
    a.supportingChunkIds.every((id, index) => id === b.supportingChunkIds[index])
  );
}

function targetsForChunkIds(chunkIds: readonly string[], sourceIds: readonly string[]): ClaimMarkTarget[] {
  const targets: ClaimMarkTarget[] = [];
  const seen = new Set<number>();
  for (const chunkId of chunkIds) {
    // An empty id is the caller masking a row a mark may not point at; it must
    // never match, and a real chunk id is never empty.
    if (!chunkId) continue;
    const index = sourceIds.indexOf(chunkId);
    // A citation the rail does not list has nowhere to open, so it is dropped
    // rather than renumbered onto a neighbouring row.
    if (index < 0 || seen.has(index)) continue;
    seen.add(index);
    targets.push({ index, sourceId: chunkId });
  }
  return targets;
}

function clusterFromTargets(claimId: string, support: "direct" | "partial", targets: ClaimMarkTarget[]) {
  if (!targets.length) return null;
  return {
    claimId,
    support,
    marks: targets.slice(0, maxMarksPerCluster),
    overflow: Math.max(0, targets.length - maxMarksPerCluster),
  } satisfies ClaimMarkCluster;
}

/**
 * Rule 1 — the fragment *is* one recorded claim.
 *
 * "Exactly one" is measured after collapsing duplicates that say the same
 * thing: the same sentence can appear both as a top-level claim and inside a
 * section, and two entries agreeing on status and citations are one attribution,
 * not a conflict. Two entries that disagree are a genuine conflict and produce
 * no mark.
 */
function singleClaimFor(normalized: string, byText: Map<string, SupportedClaim[]>) {
  const matches = byText.get(normalized);
  if (!matches?.length) return null;
  const [first] = matches;
  if (!matches.every((claim) => claimsAreEquivalent(claim, first))) return null;
  return first;
}

/**
 * Rule 2 — the fragment is exactly several consecutive claims run together.
 *
 * `splitClaims` cuts at `;` and at "and"/"then" before a clinical verb, which
 * the display splitter does not, so one displayed sentence can hold two recorded
 * claims. Merging them is only safe when **every** one is `direct`: a sentence
 * whose second half is only partly supported must not inherit the first half's
 * plain number.
 */
function consecutiveClaimsFor(normalized: string, claims: NormalizedClaim[], start: number) {
  let accumulated = "";
  const consumed: SupportedClaim[] = [];
  for (let index = start; index < claims.length; index += 1) {
    const next = claims[index];
    if (!next.normalized) return null;
    accumulated = accumulated ? `${accumulated} ${next.normalized}` : next.normalized;
    if (!normalized.startsWith(accumulated)) return null;
    consumed.push(next.claim);
    if (accumulated === normalized) return consumed.length >= 2 ? consumed : null;
  }
  return null;
}

/**
 * Resolves one mark cluster per prose fragment, or `null` where the fragment has
 * not earned one.
 *
 * @param fragments - The displayed sentences, in order, as split for display.
 * @param claims - `answer.supportedClaims`, in the order the answer carries them.
 * @param sourceIds - Chunk ids of the rail rows, **in rail order and the same length as the rail**. A mark's
 *   index is an index into this, so a row a mark may not point at (an uncited one) is passed as an empty
 *   string rather than omitted — dropping it would shift every later row's number.
 * @returns One entry per fragment, aligned by position.
 */
export function resolveClaimMarks({
  fragments,
  claims = [],
  sourceIds,
}: {
  fragments: readonly ClaimMarkFragment[];
  claims?: readonly SupportedClaim[];
  sourceIds: readonly string[];
}): Array<ClaimMarkCluster | null> {
  const empty = fragments.map(() => null);
  if (!claims.length || !sourceIds.some(Boolean)) return empty;

  const normalizedClaims: NormalizedClaim[] = claims.map((claim) => ({
    claim,
    normalized: normalizeClaimText(claim.text),
  }));
  const byText = new Map<string, SupportedClaim[]>();
  for (const entry of normalizedClaims) {
    if (!entry.normalized) continue;
    const bucket = byText.get(entry.normalized);
    if (bucket) bucket.push(entry.claim);
    else byText.set(entry.normalized, [entry.claim]);
  }

  return fragments.map((fragment) => {
    if (fragment.truncated) return null;
    const normalized = normalizeClaimText(fragment.text);
    if (!normalized) return null;

    const single = singleClaimFor(normalized, byText);
    if (single) {
      if (single.supportStatus === "unsupported") return null;
      return clusterFromTargets(
        single.claimId,
        single.supportStatus,
        targetsForChunkIds(single.supportingChunkIds, sourceIds),
      );
    }

    for (let index = 0; index < normalizedClaims.length; index += 1) {
      if (!normalized.startsWith(normalizedClaims[index].normalized)) continue;
      const consumed = consecutiveClaimsFor(normalized, normalizedClaims, index);
      if (!consumed) continue;
      if (!consumed.every((claim) => claim.supportStatus === "direct")) return null;
      const targets = targetsForChunkIds(
        consumed.flatMap((claim) => claim.supportingChunkIds),
        sourceIds,
      );
      return clusterFromTargets(consumed[0].claimId, "direct", targets);
    }

    return null;
  });
}

/**
 * How many of the rendered sentences carry a mark. Reported in the PR and useful
 * in a test as a floor: the mechanism degrading to zero marks is safe, but
 * degrading to zero *silently on every answer* would mean the wiring is broken
 * rather than conservative.
 */
export function claimMarkCoverage(clusters: ReadonlyArray<ClaimMarkCluster | null>) {
  const marked = clusters.filter(Boolean).length;
  return { marked, total: clusters.length };
}
