"use client";

/**
 * THE TWO SENTENCES EVERY STATISTICS PAGE SAYS BEFORE IT SAYS ANYTHING ELSE, WRITTEN ONCE.
 *
 * ⚠️ **WHY THIS MODULE EXISTS AT ALL.** The statistics home page and the four section pages each
 * state two things before showing anything: that every figure in this prototype is invented, and
 * that the coordinator framing is an intention rather than an access control. A reader can land on
 * any of the five directly, so all five must carry both. Until 2026-09-01 there were two
 * hand-written copies — one in `statistics-screen.tsx`, one in `statistics-section-frame.tsx` — and
 * they had ALREADY diverged in both sentences within a day of being written. No test in this
 * repository can see the difference between a disclaimer that was reworded and one that was
 * weakened, so a second copy is not a maintenance cost, it is a safety hole.
 *
 * ⚠️ **THE FOLD CHANGED THE WORDING, DELIBERATELY, AND HERE IS THE RECORD OF WHY.** Neither
 * original was true of both kinds of page, so deleting either copy would have put a false clause
 * somewhere. The differences and their resolutions:
 *
 *   - **Banner.** The home page said every instant *"they are computed from"* is invented; the
 *     section frame said every instant *"this prototype holds"* is invented. The home page's
 *     phrasing is anchored to figures it actually computes, and the section pages compute nothing —
 *     on a page with no figures, "the instants they are computed from" refers to figures that are
 *     not there. **The frame's phrasing is kept**, because it is the broader of the two: everything
 *     the prototype holds includes the instants the home page's figures are computed from, so the
 *     home page loses no force. This is a widening, not a softening.
 *
 *   - **Access.** The home page said anyone can reach the page *"and read every figure on it"*; the
 *     frame stopped at *"can reach this page"*, because there is no figure on it to read. **Neither
 *     is kept: the clause now reads "and read everything on it".** The point of the clause is that
 *     access extends to what the page shows and not merely to the address, and "everything on it"
 *     is true of a page of figures and of a page of prose alike — on the home page it INCLUDES
 *     every figure, so nothing is dropped there; on the four section pages it is finally true,
 *     where naming figures specifically was vacuous. Restoring the word "figure" here would make
 *     this sentence false on four of the five pages that render it.
 *
 * ⚠️ **THESE ARE TEXT, NOT MARKUP OR STYLING, AND THAT SPLIT IS THE POINT.** Each page keeps its
 * own banner element, its own `data-testid` and its own CSS module — every ward CSS module that
 * renders a governance banner declares `.governanceBanner` and `.prototypeBadge` on its own root,
 * and two of them borrowing another module's styling would be the only exception in the directory.
 * What drifts is the wording, so the wording is what is shared. The call sites keep their testids as
 * literals, where a grep for them still finds them.
 *
 * ⚠️ **THAT SENTENCE CARRIED A COUNT AND A THIRD CLASS NAME UNTIL 2026-09-01, AND BOTH WERE FALSE.**
 * It named a spelled-out number of ward modules and said every one of them declared a THIRD class,
 * `.notice`, beside the two above. Measured across every `*.module.css` under
 * `src/components/ward-management/`, most of the modules declaring the pair carry no `.notice` rule
 * at all — so the "every one of" was false of the very set it was counting. The population size was
 * wrong as well, and `statistics-section-frame.tsx` had written a DIFFERENT number beside it: two
 * copies of one count, disagreeing, which is the failure both comments were written to argue
 * against. No count is written here now, and the retired sentence is deliberately NOT quoted back
 * word for word: `tests/ward-statistics-sections.test.ts` forbids that wording by name, and a
 * quotation of it is indistinguishable from a relapse to any scan. A count typed into a comment is
 * a claim nothing re-checks, exactly as `statistics-sections.ts` says in its own header; the set is
 * described instead, and the test measures it from disk for anyone who wants the number.
 *
 * ⚠️ **BOTH SENTENCES ARE PINNED WHOLE, NEVER BY SUBSTRING**, in
 * `tests/ward-statistics.dom.test.tsx` and `tests/ward-statistics-sections.dom.test.tsx`. Fix round
 * 1 found the section assertions matched only `"not real figures"` and `"There is no role check on
 * this route."` — the alarming half of each sentence, with the qualifying half unguarded. A fold
 * that quietly dropped a clause would have passed both suites green, which is exactly the failure
 * this module was written to end rather than to inherit.
 */

/**
 * The synthetic-data disclaimer. Goes inside the page's own governance banner, beside its own
 * "Synthetic prototype" badge — the badge is one word and has never drifted, so it stays at the
 * call site with the element it labels.
 */
export function SyntheticFiguresDisclaimer() {
  return (
    <>
      These are <strong>not real figures</strong>. Every patient, bed, referral and instant this prototype holds is
      invented, and nothing here has been measured against a real service.
    </>
  );
}

/**
 * The access claim and the fact that nothing enforces it, said together — because an unenforced
 * claim stated honestly is safe and the same claim stated as though it were enforced is not. There
 * is no route-level role gate anywhere in these mockups; every statistics page is reachable by
 * anybody who can reach the Ward Flow mockups at all.
 */
export function CoordinatorAccessDisclaimer() {
  return (
    <>
      <strong>This is meant to be the coordinator&apos;s view — and nothing in this prototype enforces that.</strong>{" "}
      There is no role check on this route. Anyone who can reach the Ward Flow mockups can reach this page and read
      everything on it. Treat the coordinator framing as a statement of intent, not as access control.
    </>
  );
}
