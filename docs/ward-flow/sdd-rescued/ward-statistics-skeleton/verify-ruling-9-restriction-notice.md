# Verify ruling 9 — restriction notice at confirm

**Files opened:** `src/components/ward-management/ward-derivations.ts`,
`src/components/ward-management/coordinator/shortlist-panel.tsx`,
`src/components/ward-management/coordinator/flow-diagram.tsx`,
`src/components/ward-management/ward/ward-screen.tsx`,
`tests/ui-ward-coordinator.spec.ts`, `tests/ward-screen.dom.test.tsx`,
`tests/ward-restriction-notice.test.ts`, `tests/ward-derivations.test.ts`.

## 1. Is every call site's result rendered?

- **`shortlist-panel.tsx:327` `topEligibleNotice`** — rendered. Lines 586–598: a `<span data-testid="ward-shortlist-suggested-restrictive" data-level={topEligibleNotice.level}>{topEligibleNotice.text}</span>`, badge class switches on level.
- **`shortlist-panel.tsx:368` `activeNotice`** — rendered. Lines 910–923: `<p data-testid="ward-shortlist-restrictive-note" data-level={activeNotice.level}>` with wording expanded per level (`"…decision for a human, not a match."`).
- **`shortlist-panel.tsx:846` `notice` (per candidate row)** — rendered. Lines 880–891: `<span data-level={notice.level}>{notice.text}</span>` inside each candidate `<button>`, plus `data-more-restrictive="true"` on the button itself.
- **`ward-screen.tsx:1073` `notice` (incoming referral card)** — rendered. Lines 1139–1147: `<span data-testid={"ward-restriction-notice-" + movement.id} data-level={notice.level}>{notice.text}</span>`, placed directly above the card's `actionRow` (the Accept/Decline buttons).
- **`ward-screen.tsx:1234` `notice` (accepted/pulled card)** — rendered, same pattern, lines 1252–1260.
- **`flow-diagram.tsx:508` `notice`** — used both for `data-more-restrictive` on the node button (line 521) **and** rendered as visible text at lines 569–580 (`<span data-level={notice.level}>{notice.text}</span>`).

None are computed-and-discarded. Every call site's result reaches the DOM as visible text (never sorting-only, never unused).

## 2. Is it rendered at the CONFIRM step?

Two live "confirm a placement" controls exist:

- **Ward-side accept:** `data-testid="ward-accept-{movement.id}"`, label **"Accept in principle"**, dispatches `{ type: "ACCEPT_IN_PRINCIPLE", role: "ward", ... }` (`ward-screen.tsx:1149-1170`). The restriction notice for the same movement/unit pair (`ward-screen.tsx:1073`, rendered 1139-1147) sits in the **same `<li>` card**, immediately above the `actionRow` containing this exact button. A coordinator/ward user cannot see the Accept button without the notice already being in the same card above it, when one applies.
- **Coordinator-side refer:** `data-testid="ward-shortlist-refer"`, label **"Refer"**, dispatches `REFER_TO_UNITS` (`shortlist-panel.tsx:1078-1088`, footer of the same panel). Clicking a candidate row (`onClick` at line 857-860) calls **both** `onSelectUnit` (sets `activeUnit`) **and** `toggleReferTarget` (adds it to `referTargets`, what Refer actually acts on) in one action — so the candidate that becomes a Refer target is the same one `activeNotice` is computed against. `activeNotice` renders in the "Eligibility checks" section (line 910-923), above the footer holding the Refer button (line 1077+), in the same scrollable panel — not a separate screen. Additionally each candidate row shows its own notice inline (§1), independent of which one is "active".

So the notice is visible on the same screen/panel as both confirming controls, not only on an earlier screen the user may have scrolled past.

## 3. Does it distinguish the voluntary-on-locked case?

Yes — real, code-level levels, not styling alone. `RestrictionNotice` (`ward-derivations.ts:392`) is `{ level: "voluntary_on_locked" | "more_restrictive"; text: string }`. `restrictionNotice` (`:400-412`):

- `unit.security !== "Secure"` → `undefined` (no notice at all).
- `movement.legalStatus === "Voluntary"` → `{ level: "voluntary_on_locked", text: "Voluntary patient on a locked ward — review legal status before admission" }`.
- else if `movement.security === "Open"` → `{ level: "more_restrictive", text: "More restrictive than this movement requires" }`.
- else → `undefined`.

Every render site keys visual prominence off `.level` (`voluntaryOnLocked` → `*Prominent` class + `data-level` attribute) in `shortlist-panel.tsx` (×3), `ward-screen.tsx` (×2) and `flow-diagram.tsx` (×1). The `coordinator.module.css:1002,1177` comments describing "the sharper level" match this exactly — confirmed, not just asserted in a comment.

## 4. Is the flow-diagram supersession note accurate?

Yes. `flow-diagram.tsx:503-505` states `restrictionNotice` replaced `isMoreRestrictiveThanRequired`/`MORE_RESTRICTIVE_NOTE`, "still kept in ward-derivations.ts, unreferenced, pending review." A repo-wide grep confirms: their only appearances in `src/` are their own definitions (`ward-derivations.ts:384,390`) and this one explanatory comment. Grepping `tests/` finds them **only inside comments** in `tests/ui-ward-coordinator.spec.ts` (lines 606, 638) explaining the same supersession — no test imports or calls either symbol. The pair is truly dead: no code consumer, no test consumer.

## 5. What do the tests assert?

- `tests/ui-ward-coordinator.spec.ts` ("more restrictive than required…" test, ~line 590-634): a real Playwright journey — selects a movement, clicks a locked candidate row, then asserts `await expect(shortlist.getByTestId("ward-shortlist-restrictive-note")).toBeVisible();` with the comment **"And it is stated at the moment of decision — above the gate list, where the security check reads 'Met'"** (line 622-625). This is a true render/visibility assertion, not just a function-return check. A companion test (~line 652-687) pins the sharper `voluntary_on_locked` case rendering on the flow-diagram node with `data-level="voluntary_on_locked"`.
- `tests/ward-screen.dom.test.tsx:95-118` ("renders the sharper voluntary-on-locked notice once this ward genuinely holds that referral"): dispatches a real `REFER_TO_UNITS`, then asserts `screen.getByTestId("ward-restriction-notice-WF-301")` has the exact voluntary-on-locked text and `data-level="voluntary_on_locked"`. This proves DOM rendering on the ward-side incoming card, in the same `<li>` as the Accept button (confirmed structurally in §2), though the test itself does not click Accept.
- `tests/ward-restriction-notice.test.ts` and `tests/ward-derivations.test.ts` test `restrictionNotice`'s return value only (function-level, no DOM) — these establish correctness of the levels, not visibility.

The strongest rendering assertion found: `await expect(shortlist.getByTestId("ward-shortlist-restrictive-note")).toBeVisible();` immediately after selecting a restricted candidate, explicitly commented as being checked "at the moment of decision."

## Verdict

When a coordinator or ward user places/accepts an open-status or voluntary patient into a locked ward, they **do** see a warning, and they see it **before** confirming: on the coordinator's shortlist panel the notice renders per-candidate-row and again in the "Eligibility checks" section directly above the footer's Refer/Override buttons (the same click that selects a candidate also adds it to the referral target list Refer acts on); on the receiving ward's own screen the notice renders in the same card as, and directly above, the "Accept in principle" button. Both are proven by source inspection and, for the shortlist path, by a Playwright assertion that the notice is `toBeVisible()` "at the moment of decision." The older `isMoreRestrictiveThanRequired`/`MORE_RESTRICTIVE_NOTE` pair is confirmed truly dead — no code or test consumer, only its own definition and comments describing it as superseded.
