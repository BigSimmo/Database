"use client";

import { useCallback, useState } from "react";

/** The claim support statuses a mark can carry into the drawer. */
export type ClaimSupportStatus = "direct" | "partial" | "unsupported";

/**
 * Which source the answer's drawer is showing, and whether a claim put it there.
 *
 * Three values that must move together, so they are owned in one place rather
 * than in three `useState` calls a future edit can update unevenly:
 *
 * - `openIndex` — the rail row the drawer is showing; `null` while it is closed.
 * - `claimIndex` — the row a *claim* pointed at, which is a different question.
 *   Opening from the rail, or paging on from a mark, means there is no claim to
 *   speak about and the drawer must not assert one.
 * - `claimSupport` — that claim's own recorded status. The drawer's support
 *   sentence must use this and not the row's document-level `sourceStrength`,
 *   because a partial mark can sit on a strong row, and the sentence has to
 *   match the mark the clinician just tapped.
 *
 * ### Why the answer identity is a parameter
 *
 * All three are indices and statuses *into one answer*. They mean nothing
 * outside it: index 2 of the next answer is a different document, and the
 * support beside it belongs to a different claim. The answer surface is not
 * keyed per turn — the current answer replaces itself in place while earlier
 * turns move to `PriorAnswerTurnSurface` — so nothing remounts this state and
 * nothing else discards it.
 *
 * Every route out of the drawer already closes it today: it is a focus-trapped
 * `aria-modal` Sheet over a click-blocking backdrop, so the composer behind it
 * cannot be reached, and each drawer action that can start a new answer calls
 * its close handler first. That is several call sites all being right, not an
 * invariant — a new drawer action that forgot would show one answer's support
 * sentence against another answer's document. On a surface whose whole purpose
 * is saying which page backs which sentence, that has to be structurally
 * impossible rather than currently avoided, so the reset is tied to the answer
 * itself.
 *
 * The reset is applied during render rather than in an effect: this is React's
 * prop-change adjustment, and an effect would both paint the stale source for a
 * frame and trip `react-hooks/set-state-in-effect`.
 */
export function useAnswerSourceSelection(answerIdentity: string) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [claimIndex, setClaimIndex] = useState<number | null>(null);
  const [claimSupport, setClaimSupport] = useState<ClaimSupportStatus | null>(null);
  const [renderedIdentity, setRenderedIdentity] = useState(answerIdentity);

  if (renderedIdentity !== answerIdentity) {
    setRenderedIdentity(answerIdentity);
    setOpenIndex(null);
    setClaimIndex(null);
    setClaimSupport(null);
  }

  /** Opened from the rail, or paged on from a mark: there is no claim to speak about. */
  const openFromRail = useCallback((index: number) => {
    setClaimIndex(null);
    setClaimSupport(null);
    setOpenIndex(index);
  }, []);

  const openFromClaim = useCallback((index: number, support?: ClaimSupportStatus) => {
    setClaimIndex(index);
    setClaimSupport(support ?? null);
    setOpenIndex(index);
  }, []);

  const close = useCallback(() => {
    setOpenIndex(null);
    setClaimIndex(null);
    setClaimSupport(null);
  }, []);

  return { openIndex, claimIndex, claimSupport, openFromRail, openFromClaim, close };
}
