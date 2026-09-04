# Claims register — TWELVE citations that cannot fail, plus two defects in the guard

An independent audit judged all 74 `MODEL_CLAIMS` against one test:

> **If this claim became false, would the cited bytes change?**

Twelve fail it. Each finding below carries **a concrete edit that makes the claim false while
leaving the citation intact** — a suspicion without one is not a finding.

**A correction to my own count first:** there are **10** `UNEVIDENCED_CLAIMS`, not 12. I have said
12 to three chats.

## ⚠️ 1 & 2 — THE REGISTER ASSERTS IN PROSE THAT A CITATION HAS A PROPERTY IT DOES NOT HAVE

`statistics-screen/declines/ward-destination-records-bed-criteria` and its twin on the compare
screen (`WARD_DESTINATION_ARM`).

The register's own doc comment says this arm is "cited whole… only the whole arm can witness the
'never [a unit]'". **It is not cited whole.** The real arm (`ward-model.ts:844-862`) is
`kind`, `sex`, `secureBedNeeded`, `involuntaryBedNeeded`. The citation starts at `sex: Sex;` and
stops at `secureBedNeeded: boolean;` — omitting `kind` and `involuntaryBedNeeded`, touching neither
end of the body.

**Falsifying edit:** add `preferredUnitId?: string;` after `involuntaryBedNeeded`. Cited bytes
untouched, still unique, and both screens go on saying the arm "carries no unit id of its own".
A second one: delete `involuntaryBedNeeded` — the claim names it as one of the three criteria and it
sits outside the citation.

**This is the worst of the twelve because it is the register's own defect, one level up: a false
claim about its own evidence.**

## ⚠️ 3, 4 & 11 — THE `isEntirelyComment` GUARD IS WEAKER THAN IT LOOKS

**It only inspects the citation's opening character.** A citation cut to begin on the SECOND line of
a doc comment never matches `^(\/\*\*|\/\*|\/\/|\*)` and is returned `false` before the code-token
check runs. Three citations walk straight through it:

- `…/a-null-referral-id-means-a-movement` — pure comment prose from `ward-admissions.ts:270-272`,
  containing a `*` continuation marker mid-string. **Falsifying edit:** mint a referral id for
  movement-originated admissions so a null means something else. The comment does not move.
- `statistics-ed-screen/unrecordable/ed-requests-arrive-verbally` — prose at `ward-model.ts:872`,
  whose surrounding comment says of itself "This comment IS the carrier". Opens with a backtick.
  Also an ABSENCE claim, which the register's own exclusion class 2 says belongs in
  `UNEVIDENCED_CLAIMS`.
- `community-index/grouping/the-missing-region-field-is-enforcement` — phrased about the prose
  ("records it as enforcement, in those words"), so it can only fail by deleting the comment.

**The tightening:** run the code-token test on any citation containing a `*` continuation marker or
ending in `*/`, not only on ones that OPEN as a comment.

## 5 — an "only" cited by a two-field slice

`…/confirmed-at-is-one-shared-field` claims `BedRelease` carries a SINGLE `confirmedAt`. Evidence is
two fields. An "only" needs the whole body — which `REFERRAL_ADDRESSING_BODY` does correctly four
claims away. **Falsifying edit:** add `preparedAt: Instant | null;` after `confirmedBy`.

## 6-9 — four claims that a figure is DERIVED, citing its TYPE DECLARATION

`average-length-of-stay-is-derived`, `average-empty-bed-minutes-is-derived`,
`ready-but-blocked-is-derived`, `long-stays-are-derived` each cite the field's declaration in the
`WardStatistics` type rather than the line that computes it. **Two siblings do it right** —
`dischargeDateOutcomes` cites the computing line, and so does `averageWaitlistWaitMinutes`.

**Falsifying edit:** replace the computing line with `const averageLengthOfStayDays = null;` —
**precisely what already happened to `averageWaitlistWaitMinutes`.** Declaration unchanged, citation
green, ward screen still says the figure is "computed but not surfaced".

## 10 — behaviour claimed, signature cited

Both `a-site-code-may-resolve-to-nothing` entries claim `siteByCode` returns nothing rather than a
fallback, and cite the signature. **Falsifying edit:** `?? wardSites[0]`. The declared return type
is still legal and unchanged.

## 12 — "one source document", citing one loop

`the-vocabulary-comes-from-one-source-document` cites only the function head and the first loop.
**Falsifying edit:** add a second `for (const row of S2020_CATCHMENT_ROWS)` loop. The file already
models multiple documents.

## Lower confidence, listed rather than dropped

- Two claims cite a `data-testid` / `aria-label` as evidence a block IS RENDERED. Wrapping it in
  `{false && …}` leaves the string in the file.
- `only-discharged-releases-offer-the-flag` claims "alone" and cites one filter.
- Two "a SINGLE href helper" claims cite one `return` line, which cannot witness a single.
- `the-team-screen-is-a-client-module` cites `"use client";`, whose effect depends entirely on being
  the file's FIRST statement. Move it below the imports and the citation still matches, once.
- `a-movement-is-inside-an-emergency-department` claims the person is PHYSICALLY THERE;
  `originEdId: string;` witnesses only that a required id exists.

## Two defects in the test itself

- **`statistics-disclaimers.tsx` is in `REGISTERED_SURFACES` and carries ZERO pinned claims.** That
  list is documented as "the surfaces this register claims to have swept", and nothing asserts a
  registered surface has at least one claim. A surface can be declared swept while resting on
  nothing.
- **The floor is `>= 40` against 74 today**, so 34 claims could be deleted in silence. And
  `hasControlCharacter` is applied to `evidence` and `rendered` but not to `claim` or `reason` — a
  backspace byte in a claim's words would print as nothing and nothing would notice.

Otherwise the test does what the register promises; there is no vacuous path in the two main checks.

---

# THE REPAIR — and the guard is wrong in KIND, not merely weak

My proposed tightening (also test citations containing a `*` continuation or ending `*/`) was
rejected, correctly: **it is a better heuristic about characters, and characters are not the
property.** It still misses the simplest evasion — a slice cut from the middle of a SINGLE-LINE doc
comment has no `/**`, no `*`, no `*/`, and walks through both versions.

**And no comment detector can ever catch four of the twelve.** The "derived" claims cite a type
declaration; `const averageLengthOfStayDays = null;` leaves the declaration untouched. That is not a
comment and it is not detectable by looking at the citation's characters. **The guard was aimed at
one symptom; the audit found the class.**

## The right mechanism: EVERY CLAIM SHIPS WITH ITS FALSIFYING EDIT, AND THE TEST APPLIES IT

```
for each claim:
  read sourceFile
  apply the recorded falsifying edit, IN MEMORY
  assert the evidence substring is now ABSENT
```

**The cost objection dissolves** — the existing check is a substring test over file contents, so
this is a string transformation plus a second `includes()`. Seventy-four cost microseconds. No file
is written, no suite runs, no build happens. That is why it is worth doing HERE and would not be
worth doing against a real test suite.

What it buys:

- **An unfalsifiable claim becomes impossible to register.** The author must name an edit that makes
  the citation disappear. For a comment citation, a slice cited for an "only", or a declaration
  cited for a computation, **no such edit exists that also makes the claim false** — and they find
  that out at registration rather than four months later.
- **It catches the `cited whole` defect directly.** Its falsifying edit is "add
  `preferredUnitId?: string;`"; the test shows the citation still present and goes red naming the
  claim.
- **It subsumes the comment guard.** Keep `isEntirelyComment` as a cheap fast-fail with a clearer
  message, but it stops being load-bearing.

**The residual, stated honestly rather than hidden:** an author can record a WEAK falsifying edit —
one that breaks the citation for a reason unrelated to the claim. That hole does not close
mechanically. It is much narrower than what exists now, because it requires deliberately writing a
misleading edit rather than merely picking a convenient string.

**Also available and exact, if a comment check is kept:** locate the citation's match index in the
file and test whether it falls inside a `/* … */` or `//`-to-newline span. No heuristic, no evasion,
and it needs nothing the register does not already do — it already reads the file.

## The two test defects

- **Assert every `REGISTERED_SURFACES` entry has at least one claim.** `statistics-disclaimers.tsx`
  is listed as swept and pins nothing. The sweep and the failure to sweep are indistinguishable —
  the same shape as an empty category rendered as an absence.
- **⚠️ PIN THE EXACT COUNT, do not floor it.** `>= 40` against 74 means **34 claims can be deleted in
  silence — and deletion is exactly how a red gets resolved by somebody who wants a green suite.**
  Pin it the way `ADMISSION_STATES.length` is pinned at 4. A floor tells you nothing except that
  somebody chose a number below the real one.

## Order of work

**Guard first, then the twelve citations.** With the falsifying-edit test in place, each repair
proves itself as it is written rather than needing a separate review afterwards.
