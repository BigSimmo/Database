# Skeleton Task 1 — fix round 1. Four Importants. Spec compliance passed ✅.

All four are copy and linking, not structure. Nothing about the routes, the module or the tests'
shape needs to change.

## 1. The ED page promises three figures the model has no field for

`statistics-ed-screen.tsx:99` — _"How many people are waiting, how long they have waited and how
many left without a bed are all absent here **on purpose**."_

`EmergencyDepartment` is `{ id, siteCode, name }` and nothing more (`ward-model.ts:195-199`). The
only ED-attributable record in the model is a referral addressed to an ED's psychiatry service
(`ward-model.ts:801-819`). **"Absent on purpose" reads as unbuilt — meaning coming.** These are
_unrecordable_, and two of the three would need a data model nobody has proposed.

This is the one place a page implies a figure is nearer than it is, which is the exact failure the
section exists to avoid. Say what the record actually holds about an emergency department, and
distinguish "not derived yet" from "the model has no field for this and adding one is a design
question, not a task".

## 2. The honesty is load-bearing on one page of four

Only the comparisons page reaches the home page's standard — `statistics-compare-screen.tsx:94`
names `ReferralAddressing` and says exactly why a decline can never be attributed to a named ward.
**The other three gesture at honesty in words that would survive any codebase.**

- `statistics-overview-screen.tsx:72` — _"the statistics home page already withholds one figure the
  owner asked for, because the model records it in two places that mean different things."_ It
  names neither the figure nor the field. Name them: declines per ward, `ReferralAddressing`
  versus `Movement.declines`.
- `statistics-ward-screen.tsx:106` — _"Beds, occupancy, availability, how long people stay and how
  long they wait are all absent here on purpose."_ **Two problems in one sentence.**
  - `src/components/ward-management/ward-statistics.ts` **already computes** length of stay,
    empty-bed minutes, discharge-date outcomes, ready-to-leave-blocked and long stays per unit —
    and has no consumer in `src` at all, only its test. So the page **understates how near those
    figures are**. Say they are computed and not yet surfaced, which is a different and much
    smaller gap than "absent".
  - It misses the one genuinely blocked figure sitting right there:
    `WardStatistics.averageWaitlistWaitMinutes` is **always `null`**, because no instant on
    `Admission` marks entry to `"waitlisted"` (`ward-statistics.ts:57-68`). That is a
    `BedRelease.preparing`-grade gap, already written down, and the page does not name it. **Name
    it.** It is the best example on this page of the thing the section is for.

**Read `ward-statistics.ts` — do not write it.** It is another chat's file. This finding is about
the ward page's COPY being accurate about it, not about consuming it.

## 3. The chooser anchor exists but nothing on these pages uses it

The anchor is real (`id={STATISTICS_UNIT_CHOOSER_ID}`, pinned by both tests) and the section href
carries the fragment. But **all four in-page links back to it drop it**:
`statistics-ward-screen.tsx:63,119` and `statistics-ed-screen.tsx:59,111` use bare
`STATISTICS_COMPARE_HREF`.

A coordinator clicking _"Choose a ward from the comparisons page"_ lands at the top of a page that
opens with two sections about why no comparison exists, and must scroll to find the list.

**Worse: `tests/ward-statistics-sections.dom.test.tsx` asserts the bare href exactly, so the miss
is now pinned as intended behaviour.** Fix the four links AND the assertion that blesses them.

Also: the compare screen's explanation of why the chooser lives there is in a source doc comment,
not on the screen. A reader who arrives wondering why the unit list is on a comparisons page finds
no answer where they are looking.

## 4. The two duplicated disclaimer sentences have ALREADY diverged — both of them

- Banner: `statistics-screen.tsx:97` "…every instant **they are computed from** is invented" vs
  `statistics-section-frame.tsx:59` "…every instant **this prototype holds** is invented".
- Access: `statistics-screen.tsx:118` "…can reach this page **and read every figure on it**" vs
  `statistics-section-frame.tsx:86` "…can reach this page."

Both divergences are defensible — these pages compute nothing and show no figures. **The problem
is that the DOM tests only assert substrings** (`"not real figures"`,
`"There is no role check on this route."`), so a later fold that silently drops a clause passes
green.

**Do not fold the two copies in this round** — `statistics-screen.tsx` is Task 2's file and folding
is Task 2's job. Do this instead: tighten the frame's assertions so the _whole_ sentence is pinned,
not a substring, and record in the frame's doc comment that the two wordings deliberately differ
and why — so Task 2 chooses wording true of both a page with figures and a page without, rather
than deleting one copy and losing a clause.

## Minors — fix only if free, otherwise leave

- `.sectionHeading` gives `<h2>` and `<h3>` identical rules, so "Wards" / "Emergency departments"
  render identically to the section headings above them; the hierarchy exists only for a screen
  reader.
- `statistics-overview-screen.tsx:41` says the skeleton is "the route, the way in and the account
  of what belongs here" — there is no way in yet.
- Both not-found states render a near-duplicate `<h1>` and `<h2>`.
- The numeral test renders all four screens into one document, producing four `id="main-content"`.
