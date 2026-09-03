# Owner rulings, 2026-09-02 afternoon — verbatim, with what each settles

**Recorded by Ward Lead. Each ruling is quoted in the owner's own words, because a paraphrased
ruling is how a question becomes a defect and a defect becomes a rewrite.**

---

## R1 — The engine stays advisory

> **"Keep advising and let the clinician decide!"**

**Settles A1**, the largest open item in the project. The engine does not enforce placement and **it
is not going to.** The eligibility check exists to inform a coordinator, not to stop her.

⚠️ **He answered this against a worked example that was WRONG, and the answer survives the
correction.** The example said the system accepts an ineligible placement silently. It does not: the
ordinary Refer button is disabled for an ineligible bed and says _"Not eligible — [reason]. Use
Override instead."_ Since his ruling is "keep advising", the corrected picture — advice plus a named
override path — is closer to what he asked for than the example he was shown. **The ruling stands.
It was not obtained by alarm.**

**What is still worth doing under this ruling, and it is small:** the warning is shown **once,
upstream**, and is **not repeated at the moment of the irreversible click**. The Override button
carries no eligibility text of its own, `canOverride` checks only that a ward is ticked, and the
override form says nothing but _"Choose a reason"_ and _"Record override"_. A coordinator working
quickly, or one whose screen never scrolled up, can complete an override having never re-read what
the bed failed. **Under "keep advising", advising better at the point of commitment is the whole
remaining job.** Not a gate — a sentence.

## R2 — No viewer identity. Scope by screen instead.

> **"NO... no other wards know who is looking. They are not given any information. Only the
> coordinator has all the information. The state wide coordinator screen."**

**Settles A2, and with it A3, A4, A5 and A6 — five questions in one sentence.**

**The app does NOT learn who is looking.** That was the wrong shape. The rule is simpler and
stronger: **a ward screen does not carry cross-ward information at all**, so there is nothing to
scope at read time. **Only the statewide coordinator screen holds the whole picture.**

Consequences, stated so nobody re-derives them:

- **A3** — the sidebar must not name other wards a patient was referred to. Settled: it must not.
- **A4** — the patient workspace must not show how many wards were tried or which accepted. Settled.
- **A5** — the suburb. A ward must not have it. ⚠️ **Already absent from the coordinator projection,
  measured with controls both ways, so the job is the GUARD, not a removal.** And a field's absence
  today is an accident that happens to agree with the ruling; this ruling turns it into a decision.
- **A6** — cross-page inference across the 65 community team pages. **This ruling does not resolve
  it and nobody should pretend it does.** Those pages are not ward screens, and two of them together
  still reveal a person was referred to both. **Still open.**
- ⚠️ **And it bears directly on `§4.11`, the one proven-unguarded defect:** a withdrawal record can
  carry the refusing wards' names in free text. **Under R2 a ward may not be told that. The ruling
  makes that finding a defect rather than a question.**

**The design principle, in one line: information is scoped by SCREEN, not by VIEWER.**

---

## R3–R9 — the seven he approved in the same message, recorded because they were nearly lost

⚠️ **These were answered in the same reply as R1 and R2 and I recorded only the two big ones. An
audit found the gap by reading the repository rather than my chat: it reported A16 as still open
because nothing in the repository said otherwise, and it was right to.** A decision that exists only
in a chat window is not a decision anyone else can act on — the same failure that nearly lost Ward
Verifier's report and three chats' working notes.

| #      | Question                                                                    | His answer                                                                                                                                                                                                                                                                                           |
| ------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R3** | Should the referrals board say what an ED referral was actually asking for? | **Yes** — and more: _"When a patient is referred on the ED referral board, it should say where they have been referred to, the referral status, wait time, etc. When a patient is on the inbox to review, it should also say if they are medically cleared etc."_                                    |
| **R4** | Should the ED form let one-to-one nursing be set?                           | **Yes**                                                                                                                                                                                                                                                                                              |
| **R5** | Should the four provenance controls get a blank option?                     | **Yes**                                                                                                                                                                                                                                                                                              |
| **R6** | Should the demo data include a referral to two places at once?              | **Yes** — this is **A16**, and it is SETTLED, not merely measured                                                                                                                                                                                                                                    |
| **R7** | Should the board's control-border contrast be fixed?                        | **"address this"**                                                                                                                                                                                                                                                                                   |
| **R8** | The patient screen and the add-patient screen                               | _"Ensure you have built the patient screen. Also ensure you have built the screen where a new patient is added."_ ⚠️ **A verification job first, not a build job** — the patient screen already exists and its referral button already navigates; the add-patient screen does not exist.             |
| **R9** | May an emergency department's name appear on a ward's inbox card?           | **"yes widen the second check too"** — answered directly to Ward Builder One and built. ⚠️ **Consequence: a ward's inbox card may now NEVER name another hospital's ED. A future card meant to read "arriving from RPH Emergency Department" will go red.** Right default, and somebody will hit it. |

## ⚠️ WHAT R2 REQUIRES THAT IS NOT YET BUILT

**R2 is a decision, not a change. The code still does the opposite in two places**, both found by
audit at `f9590eed1` rather than assumed:

- **`shortlist-panel.tsx:584`** renders `Parallel referral: {unit.name}` — **naming other wards.**
- **`ward-management-console.tsx:313`** renders `${patient.referredUnitIds.length} referred`, and
  `:346-354` names the alternative wards. _(Reachable only via a `/mockups/**` route today, which
  changes the urgency and not the verdict.)_

## ⚠️ AND ONE THING NOBODY RULED ON THAT ALREADY HAPPENED

**A Ward Flow branch has already modified `src/app/**`** — commit `c08fa31d6` changed
`src/app/loading.tsx` and added `src/app/(search-app)/loading.tsx`. **A24 asks whether that is
permitted and it was never answered; the change is on this branch and is not on `origin/main`.**
And **A25**: five production routes — `auth`, `privacy`, `safety-plan`, `applications`, `reference` —
have **no `loading.tsx` at all** at this commit, checked directly. **Nothing has re-checked that
since the change that caused it.** Both still need him.

---

## R10 — A community team sees only its own referrals

> **"Community team sees only its own referrals"**

**Settles A6, the one privacy question R2 explicitly did NOT close.** R2 covered ward screens and the
coordinator; a community team was a third viewer nobody had defined. Now defined.

### ⚠️ THE LEAK IS ONE COMPONENT AND IT IS EXPLICIT

`community-screen.tsx:453-463` renders a nav headed **"Other community teams"**, listing every one of
the other teams as a link to its page — and **each of those pages names the people referred to that
team.** Verified at `26343fe75`, in the source, not inferred.

**So the inference is not an emergent property of 65 pages happening to exist. It is a navigation
control, on each team's own page, offering the other 64.** A team does not have to guess a URL or
find an index; the route is rendered for it, headed with its own name.

**Under R10 that nav must go from the team page.**

### What R10 does and does not require

- **A team's own page already shows only that team's referrals.** That half was already right.
- **The "Other community teams" nav must not appear on a team page.** That is the whole fix.
- **The community INDEX at `/community` is a different question.** Under R2's "scope by screen", an
  index listing all 65 is a coordinator surface — legitimate for the coordinator, and it must not be
  reachable from a team's own page. ⚠️ **R10 does not say the index must go; it says a team must not
  be handed the others.**
- ⚠️ **And the guard matters more than the change here**, because R2 ruled out viewer identity: there
  is no runtime check that can enforce this. Nothing but a test will hold it, and the next person to
  add a convenient cross-link will not know they broke a ruling.

### Why this was worth asking rather than assuming

Two chats independently called A6 _"not answerable by any search over source"_ — a question about the
product's shape. **They were right that no search answers it, and the search still mattered: it found
the mechanism in one component rather than in the existence of 65 pages, which turns a design worry
into a ten-minute change with a guard.** The question needed the owner; the remedy did not.
