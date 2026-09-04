# Seven false claims in the statistics prose

From a read-only Opus audit at `5b6f13189`. **Full detail, with quoted counter-evidence per
finding, is in `.superpowers/sdd/ward-statistics-skeleton/audit-statistics-prose.md` — read it.**
This brief carries the rulings, the ordering, and the three I verified myself.

**Three are RENDERED to the screen. Those outrank the four comment-only ones absolutely** — a
clinician reads rendered prose as fact and never opens the file.

## R1 — RENDERED. A note that became false by being completed. VERIFIED BY ME.

`statistics-overview-screen.tsx:60`, inside a bolded not-built block:

> "There is no way in from the statistics home page yet — the index that will link here is separate work."

**FALSE, and I confirmed every link in the chain by reading:**

- `statistics-sections.ts:47` declares `STATISTICS_OVERVIEW_HREF`.
- `statistics-sections.ts:86` makes it the `href` of the **first** entry in `STATISTICS_SECTIONS`.
- `statistics-screen.tsx:197` renders `{STATISTICS_SECTIONS.map((section) => (` inside a `<nav>`.

So the statistics home page links to this page, first in the list, and this page tells the reader it
does not. **The conclusion falls with the reason — DELETE the sentence, do not rewrite it.** There is
no corrected version; the absence it describes no longer exists.

**Why this one matters beyond its own fix.** It was TRUE when written. It became false when I built
the index, in the same session, and nothing connected the two. Every "not built yet" note in this
tree is a claim with the same shape. **Sweep for the others** — grep the statistics tree for `yet`,
`not built`, `separate work`, `will link`, `to come`, `for now` — and check each against what now
exists. Report what you find even if it is outside these seven.

## R2 — RENDERED. A fact about the person, described as a fact about the bed.

The ward page claims every instant on `Admission` is "about the bed or about the discharge plan".
`ward-admissions.ts` says **in bold** that `awayAtEmergencyDepartmentSince` "is a fact about the
PERSON". Conclusion does not survive as stated; the enumeration needs the third category.

This is the same field whose bed-holding property another chat's test fails to guard — the
distinction is load-bearing, so state it exactly as `ward-admissions.ts` states it.

## R3 — RENDERED. An unmeasured "most".

The home page asserts "most" counted movements were put to three wards. **Nothing measures this.**
Either compute it from the data and render the computed value, or remove the quantifier. **Do not
write a hand-checked number** — an unrendered count is unguarded and goes stale, which is how the
community screen ended up claiming "nine teams" against 65 clinics.

## C4–C7 — comment-only, fix in this order

- "eighteen ward modules declare all three classes" — **six** do. Recount and cite the counting
  method, or describe the set without a number.
- the statistics route page forbids three props; the screen takes **four**.
- the claims register's opener says "every statement" — it does not cover every statement, and
  saying so invites exactly the false confidence the register exists to remove. Qualify it.
- the frame says "no controls" beside a rendered `ClinicalRail`.

## Constraints

- **Files:** `src/components/ward-management/statistics/**` and `tests/ward-statistics*` ONLY.
- **READ ONLY:** everything under `community/`, `ward-admissions.ts`, `ward-model.ts`,
  `ward-reanchor.ts`, the seed. Read them to verify; never edit them.
- **Do not edit `statistics-claims-register.ts`'s entries** except the C6 opener comment. If a
  rewrite breaks a register pin, STOP and report the claim id and the correct evidence.
- **Verify every citation against the file before writing it.** Line numbers here are hints.
- **Add an assertion per rewritten claim asserting the ABSENCE of the old wording**, not only the
  presence of the new. For R1 that means asserting the deleted sentence cannot return.

## Known-weak pins to repair while you are in here

The falsifiability audit found two register entries pinning the reducer's **error message** rather
than the `if` condition implementing the guard — so a neutered guard that kept its message text
passes unnoticed. Ids: `statistics-derivations/beds-being-prepared/set-bed-preparation-has-a-unit-guard`
and its `-note-guard` sibling. Repoint both at the condition. Detail in
`audit-register-falsifiability.md`.

## Gate

```
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run $(ls tests/ward-statistics*.test.ts tests/ward-statistics*.test.tsx | tr '\n' ' ')
```

Echo the discovered list. Refuse an empty discovery. **Report the RAN count, not the passed count.**
