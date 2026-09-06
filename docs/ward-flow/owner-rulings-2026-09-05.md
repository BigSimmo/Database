# Owner rulings, 2026-09-05

**Reconstructed 2026-09-06 by Ward Verifier from commit bodies, because this day had no ruling
document and every other day since 2026-09-01 has one.** 2026-09-01, 09-02, 09-03 and 09-04 each
have a file under `docs/ward-flow/`. 2026-09-05 had none, while roughly fifty code comments across
`src/components/ward-management/**` and `tests/**` cite "the owner's ruling of 2026-09-05" as
settled authority.

⚠️ **THE CONSEQUENCE IS NOT UNTIDINESS. IT IS THAT THIS PROJECT'S OWN PROVENANCE METHOD WOULD HAVE
CALLED THESE INVENTED.** `wards/ward-index.tsx` describes that method in detail — a content search
over 4,800+ documents, across the working tree and both ward branches — and it searches DOCUMENTS.
Every ruling below lived only in a commit body, which that search does not reach. A future session
doing exactly what was done for the ward-index restraint would have returned **UNTRACEABLE** for
real rulings quoted verbatim, and the honest reading of UNTRACEABLE is "we could not find it", which
is one short step from "somebody invented it".

## How this was assembled, and what it is not

**Method.** Every commit on every branch between 2026-09-04 and 2026-09-07 — 919 of them — had its
body searched for a 2026-09-05 owner attribution, then each match was read in full. Where the
commit quotes the owner's words, they are reproduced here verbatim and marked as such. Where it
records a ruling without quoting him, that is stated rather than smoothed over.

⚠️ **THIS IS A RECONSTRUCTION, NOT A CONTEMPORANEOUS RECORD, AND THE DIFFERENCE MATTERS.** The other
batches were written by the session that received the ruling. This one was assembled a day later by
a session that was not in the conversation. **It can only be as complete as the commit bodies are** —
a ruling given on 2026-09-05 and implemented without an attributing commit body is invisible to this
method and is not here. Treat the list as a floor on what was decided, never a ceiling.

---

## 1. FD-13 — one story box, optional

> **Verbatim:** _"one story box, optional, and keep the two-pane layout."_

`364168d23`. This settles `FD-13` in its original favour: that ruling of 2026-08-30 specified
exactly ONE story field, labelled, optional, and the form built on 2026-09-05 had three, the first
of them required. `Referral.history: string` replaced `historyWhyNow` + `historyBackground` +
`historyRiskAndSafety`; `REQUIRED_HISTORY_FIELD` and the reducer's blank refusal were deleted.
`REFERRAL_HISTORY_LIMITS` became `{ history: 2000 }` — the largest of the three superseded limits,
taken rather than re-derived, so the change authors no fresh clinical figure.

Cited at `ward-model.ts:1439`, `:1453`, `:1574`, `ward-flow-reducer.ts:2548`,
`referrals/referral-intake.tsx:661`, `:765`, and in six test files.

## 2. "Ready" counts beds the application refuses to admit into

> **Verbatim, as recorded:** _"Ready" counts beds the application refuses to admit into, so the
> cleaning count sits beside the figure and the figure does not move._

`da4b7b373`, then carried to further screens by `836c9dc2a`. `Ready` derives from
allocatable/empty and did not account for beds free but still being cleaned, while the reducer
refuses `PULL_PATIENT` with _"every free bed at X is still being made ready"_ — the screen and the
reducer disagreeing about the same bed.

**The shape of the ruling is the load-bearing part: the count sits BESIDE the figure and is never
subtracted from it.** Cited at `capacity/capacity-derivations.ts:151`, `capacity-screen.tsx:478`,
`ward/ward-screen.tsx:309`, `:1067`, `ed/ed-screen.tsx:2325`, and in four test files.

## 3. A form made in the same minute as arrival is community-formed

> **Verbatim:** _"since formed"._ Asked directly and answered directly.

`31cecf72f`. The boundary is `<=`, not `<`. **He was asked precisely because the elapsed figure is
identical either way** — both references are the same instant — so the only thing this changes at
the boundary is which authority the screen names. "Since opened" over a patient who has a form
implies no form was made, which would be untrue.

Cited at `ed/ed-screen.tsx:616`, `ward-movements.ts:562`, and `tests/ward-ed-legal-clock.dom.test.tsx`.

## 4. The patient handover board comes back

> **Verbatim:** _"No... I did not mean drop that."_ then _"Please add it back in this same new
> design style for me."_

`d145f0d93`. The tab was labelled "Ward board" and the thing inside it was the patient handover
board; the label did not describe the contents, and the contents were dropped on the strength of the
label.

## 5. The ED screen is the ED Hub, and the ward-board tab leaves it

> **Verbatim:** _"You are designing Ward ED Hub Screen. So drop that tab"_, and _"this is just for
> incoming and outgoing ED referrals related to this particular ED. It is the ED HUB. Rapid switch
> between ED hubs at the top."_

`4372c2755`.

## 6. Mark it, do not filter it

> **Recorded as a ruling, in capitals, but NOT as a quotation:** OWNER RULED: MARK IT, DO NOT FILTER
> IT.

`9333e9872`. A patient who had self-discharged was rendered under "Accepted, awaiting bed" with a
running clock and counted in that stage's total. **Filtering would delete the useful fact — that a
move was abandoned is what a board like this is for — and silently shrink the count.**

⚠️ **No verbatim words are recorded for this one.** The decision is attributed to the owner and the
reasoning is written out, but what he actually said is not on the record. Cited at
`movements/movements-screen.tsx:232`, `:291`.

## 7. A team page says its name is spelled more than one way, and the software does not merge them

> **Recorded as _"the owner's ruling, implemented literally"_ — NOT as a quotation.**

`3f126a357`. The S2015 catchment table spells several services more than one way. A team page now
says so, and the software does NOT normalise them: **deciding `Midalnd` means `Midland` would move a
patient from one team's list to another's on a guess.** A visible split a reader has been warned
about is safer than an invisible merge nobody has been.

⚠️ **No verbatim words are recorded.** Cited at `community/community-screen.tsx:1020`,
`community/community-vocabulary.ts:309`, and in three community test files, two of which state it
more strongly than this commit does — `ward-community-ratified-aliases.test.ts:18` says the owner
ruled `ICC` and `Inner City Clinic` are one service. **That is a stronger claim than "says its name
is spelled more than one way" and its own source is not in this reconstruction.** It is flagged here
rather than resolved, because inventing the missing half is the failure this document exists to
prevent.

## 8. The statistics overview page stays and will be filled in later

Cited at `tests/ward-statistics-overview-parked.dom.test.tsx:20`. **No commit body recording this
ruling was found by the search described above**, so it appears here with its citation and without
evidence, which is the honest state of it.

---

## What remains open after this document

- **Two rulings (6, 7) are attributed without a quotation, and two claims (7's stronger form, and 8)
  have no located source at all.** They are listed so the gap is visible. **Do not close a gap here
  by writing plausible words into it** — an invented quotation is worse than an acknowledged
  absence, because it cannot be told from a real one afterwards.
- **The general hazard, which outlives this day.** A ruling recorded only in a commit body is
  invisible to the document search this project uses to establish provenance. **When a ruling
  arrives, the commit body is the right place to quote it and is not a sufficient place to keep
  it.** One line in a dated batch file is what makes it findable by the method anyone will actually
  use.
