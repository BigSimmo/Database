# Task — four community sentences explain an absence with the wrong cause

**This is clinical-adjacent and it is currently misleading on all 65 team pages. It is not waiting
for anything.**

## The defect

`community-screen.tsx:225` renders, inside a bolded safety notice:

> _"An empty list here means nobody referred to this team has a recorded discharge to the
> community."_

**That says there is nothing to act on. The truth is that we cannot tell you.** In a clinical
display, converting _unknown_ into _nothing-to-do_ is the worst direction an error can run, and it
is running that way on every page at once.

**Why the list is empty:** `admissionBelongsToTeam` looks up `admission.referralId` in the referral
list, and every seeded `referralId` is MANUFACTURED from the admission's own id
(`ward-admissions-seed.ts:227, 259, 313, 349`). The lookup cannot succeed for any seeded admission.
It is a dangling reference, not a data condition.

**And the harm is not theoretical.** `ward-admissions-seed.ts:722` is `AD-LEFT-01`, whose own
comment reads _"THE CASE THE COMMUNITY HUB EXISTS FOR: went home, and somebody recorded that no
follow-up"_. It carries `followUp: { state: "not_arranged" }` — **a patient sent home with no
follow-up arranged, which is exactly the case a community team must not lose.** Its sibling
`AD-LEFT-04` carries `"arranged"`, and the seed says the contrast is the point. **The one the hub
exists to surface is invisible, and the page tells the reader there is nobody like that.**

## ⚠️ WRITE ABOUT THE MECHANISM, NOT THE DATA — this is the whole task

A sentence about today's DATA becomes wrong when the join is fixed. A sentence about the MECHANISM
is true in both worlds. The shape to use:

> _"A patient appears here when their admission record names the referral that sent them to this
> team. None currently do."_

**Sentence one is permanent and never needs revisiting. Sentence two is the only part that changes**
— and when the join is fixed it simply stops being written, or becomes a count. One edit now, a
one-clause edit later, nothing false in between.

It is also **better** than the version written after a fix, because it tells a reader what would
have to be true for somebody to appear — which is what lets them judge an empty list rather than
trust it.

## The four sentences

1. **`community-screen.tsx:225-226`**, above. The worst, and inside a bolded safety notice.
2. **`ward-community-discharged-empty` (~:231)** — _"No admission referred to this team is recorded
   as discharged to the community."_ Vacuously true, reads as a data finding.
3. **`ward-community-unattributable` (~:187-188)** — _"Expect that to be most of the ward: naming a
   community team is something a referrer does rarely and deliberately."_ **It is not most, it is
   ALL**, and the cause is a dangling reference, not referrer behaviour.
4. **`ward-community-unattributable` (~:185-187)** enumerates two causes — no community destination,
   no referral at all — and **omits the only cause actually operating**: a `referralId` matching no
   referral in state.

## Also fix, same file, same class

- **`community-screen.tsx:189-191`**, rendered in bold: _"This page is a complete picture of who was
  referred to this team."_ Complete only among admissions whose `referralId` resolves — which is
  none. **The bold makes it the strongest claim on the screen** and the code supports only the
  weaker "of those referrals this prototype can resolve".

## Constraints

- **Files:** `src/components/ward-management/community/community-screen.tsx`,
  `community-derivations.ts`, and `tests/ward-community-*`. Nothing else. The seed, `ward-model.ts`
  and everything in `statistics/` are READ ONLY — another implementer holds the statistics
  directory right now.
- **Do not fix the join.** It is another chat's file and another chat's task. You are fixing what
  the page SAYS about it.
- **Keep every conclusion.** The list is still not a list of people missing follow-up; an empty list
  still must never be read as everybody being followed up. Only the stated CAUSE changes.
- **Add an assertion per rewritten sentence** proving the old wording cannot return — assert the
  absence of the data-condition phrasing, not just the presence of the new.

## Gate

```
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run $(ls tests/ward-community*.test.ts tests/ward-community*.test.tsx | tr '\n' ' ')
```

Echo the discovered list, refuse an empty discovery, and **report the RAN count, not the passed
count**.
