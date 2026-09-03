# Ward Builder One — session log, 2026-09-02

Branch `claude/ward-builder-community-route`, tip at time of writing `4a6f0d148` (fast-forwarded to
the master line `codex/task-ward-flow-live-state-20260831`; master is an ancestor, tree clean).

⚠️ **Every measurement below names the tree it was taken at. That is not decoration — the one thing
I got wrong tonight was a real measurement reported without its SHA.**

---

## 1. The browser suite: 18 red → 0

**56 passed, 0 failed, exit 0, 1.8m, chromium-mockups, at `e24e7b374`.**

⚠️ **Green by the criterion that costs something: the run revealed no NEW causes** — not merely that
a known list emptied. A failure list is a snapshot of what fails FIRST in each journey, so repairing
the front reveals a layer that was never reachable before.

Six spec files discovered from disk **three ways** rather than named by hand — a filename glob, a
content grep for the route, and a structurally different net on ward-module imports; the first two
agreeing on an **empty name-diff**, the third a strict subset whose control fires on non-ward specs.

Three stale tests, each against a deliberate decision the test never learned about:

| Spec                  | Cause                                                         | Commit that made it stale |
| --------------------- | ------------------------------------------------------------- | ------------------------- |
| `ui-ward-coordinator` | a flagged-urgent patient outranks every tier, by owner ruling | `bc7cb70fb`               |
| `ui-ward-management`  | Male-only ward correctly excluded for a Female patient        | `6cc80c774`               |
| `ui-ward-roles`       | `HANDOVER_READY` now requires a real booked transport         | `5cc23173a`               |

**And one live defect, not merely a merge hazard:** `shortlist-panel.tsx` gave two visually different
badges one testid, so the single assertion counting them summed two kinds and could not tell three
resolved referrals from two resolved plus one unresolved. Renamed the unresolved arm to match
`origin/main` `d29f70eff`; split the assertion 3/0. ⚠️ **Renaming BOTH arms, as first instructed,
would have recreated the ambiguity under a new name.**

## 2. The morning journey stopped claiming to drive a paused tour — `b260507e4`

Four assertions kept of roughly thirty. Verified before cutting: `MorningBody` renders no
`<ViewControl>`. Mutation-proved (removed the first rail click → red; restored, SHA-256 identical).

⚠️ **NAMED, NOT HIDDEN: `confirmedToday`/`expectedToday` now have NO browser assertion anywhere.**
Confirmed suite-wide by Ward Verifier with a control. **Un-pausing the tour does not restore it.**

## 3. The `playwright.config.ts` merge, and a hole in the guard — `c9ddf7268`

Four mutations, each restored byte-identically:

```
dropped ward-morning        -> RED, and it named the file
dropped dictionary          -> isolation test GREEN (blind); playwright-pr-shards RED
dropped care-plan-mockup    -> RED, via its own dedicated test
dropped sidebar-live-mockup -> ⚠️ ALL 55 GREEN. NOTHING CAUGHT IT.
```

⚠️ **Five mockup tokens have a spec on disk and NO guard of any kind** —
`answer-chat-perfected-mockup`, `document-image-status-mockup`, `document-top-navigation-mockup`,
`sidebar-live-mockup`, `therapy-navigation-mockup`. **Drop one and the suite reports green having
run one fewer journey.** OPEN. The one-assertion fix would DELETE four per-family tests as well as
add one, so it needs its own mutation run — deliberately not attempted during a fold.

## 4. Cold read of Ward Builder Three's branch, `cbff13006..95637ba44`

Seven dimensions, six subagents. ⚠️ **On the headline question the answer refuted the premise: Three
WAS hunting shadowed mutations and found the pattern in its own work** — findings 9.9 and 14.1
reclassified as type-checker reds rather than banked, and mutation M4 mutated the guard ORDERING
unprompted.

**Two findings, both since CLOSED:**

- A register mis-stated its own ratio (claimed 11/2; actual 13/4). **Corrected in the file; the wrong
  split survives only in the immutable commit message, which is where it should survive.**
- `4d289a277` was titled _"pin what EACH eligibility path asks"_ and pinned one. **Closed by ADDING
  the front-door pin** — exact ordered array, nine gates, with an anti-vacuity precondition that
  THROWS rather than asserts.

Commit-messages-versus-diffs: **32 of 32 opened**, one discrepancy (the ratio above).

## 5. Independent mutation of the override guard — at `c85416b37`

**The guard was author-mutated-only until this run.** Baseline first, because without it every
mutation red is ambiguous.

```
BASELINE                               1 failed | 17 passed   (the stale-allowlist demand)
M1  break the parse                    9 failed | 9 passed
M2b empty the allowlist                3 failed | 15 passed
M2d dispatch outside the scanned dir   4 failed | 14 passed
M2a remove one member's overrideReason 3 failed | 15 passed
restore -> baseline                    1 failed | 17 passed
```

**Every claim the guard's own doc comments make held.** M1's decisive line: the test named _"so a
broken parse is told apart from a real change"_ returned `expected +0 to be 4` — the AST collapsed to
zero while the text count held at 4.

⚠️ **M2a IS THE FINDING. Removing one member's field dropped the AST set to 3 — and the text-vs-AST
cross-check stayed SILENT, because BOTH sides collapsed to 3 together.** The exact-set snapshot pin
caught it. **That is a MEASURED argument for redundant guards: an equality between two derived
quantities has a failure mode neither quantity has alone — they can move together. A pin against a
hand-written literal cannot.**

⚠️ **And my own prediction was WRONG in the direction that invents:** I predicted the needle
cross-check would be red on arrival at 6-vs-4, because a doc comment contains the literal twice.
**Three had already hardened it** (`.trim().startsWith(needle)`). **Had I skipped the delta re-read I
would have reported a repaired guard as broken.**

## 6. ED decline options — observed, at `c85416b37`

**Screen first: exactly FOUR `<option>` elements** — "Choose a reason", "Belongs to another service",
"Referred elsewhere", "Another reason — needs follow-up", in that order. ⚠️ **Four OPTIONS = three
derived reasons plus the placeholder, not four reasons.** Then the assertion: `1 passed (4.2s)`.

---

## ⚠️ The error I made, recorded because the mechanism matters more than the fact

**I reported "the master line is red" having measured only my own tree at `b13cb4b80`, which
predated the fix `597481bdf` by hours.** Master was green. I ran the right command on a real tree and
**named the wrong subject**.

**I have a written rule against exactly this — state every observation with its SHA — and skipped it
on the one report where it mattered.** _"1 failed at `b13cb4b80`"_ would have been corrected in one
line at no cost.

⚠️ **It is the fifth instance in one session of the same shape, on a different axis.** Four were
_what_ I counted; this was _where and when_:

| I measured                          | The claim was about          |
| ----------------------------------- | ---------------------------- |
| total `overrideReason` declarations | declarations each side ADDED |
| string occurrences of an event name | AST construction sites       |
| rows containing the word "TESTED"   | the Method column's value    |
| decline REASONS                     | rendered `<option>` elements |
| **my tree at `b13cb4b80`**          | **the master line**          |

**Five stops being bad luck and becomes the thing to design against: a measurement is not a fact
until its subject is named — the unit, the tree, and the moment.** ⚠️ **Not one was caught by being
careful. Every one was caught because the number clashed with something already read.**

---

## Open, and owned

| Item                                                                | State                                                     |
| ------------------------------------------------------------------- | --------------------------------------------------------- |
| Five unguarded mockup tokens (§3)                                   | OPEN — fix deletes four tests, needs its own mutation run |
| `confirmedToday`/`expectedToday` unasserted (§2)                    | OPEN — named in the file header                           |
| Six ED assertions go non-discriminating when the engine null-checks | OWED, trigger named                                       |
| Escapes in ordinary strings never used as patterns                  | UNSWEPT by judgement (visible in output, not silent)      |
| Adversarial read of the patient link                                | **WAITING on Ward Builder Two's write half**              |

**Owner questions carried:** `prior_decline` overridability; `address` on a referral (unruled —
silence is not permission); board border-contrast 1.40:1 light / 2.22:1 dark against WCAG 1.4.11's
3:1 (OBSERVED by me); and that the patient link makes referral history findable, which FD-23 says a
ward may not see.
