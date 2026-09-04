# Ward Builder Two — full session review, 2026-09-02

**Written at the owner's request: everything done in the last twelve hours, and every issue.**

**Window covered:** 2026-09-01 20:55 → 2026-09-02 10:55 Perth. That is fourteen hours — the twelve
asked for, plus the two before them, because cutting at exactly twelve would have split one piece of
work in half.

**Totals:** 38 commits I authored, 4 merges of the integration line into mine, **+3,699 / −725 lines
across 25 files**. Working tree clean. Branch `claude/ward-builder-two`, tip `c60a26d03`, 11 ahead /
21 behind `codex/task-ward-flow-live-state-20260831`.

**How the 38 were attributed, because it matters.** All five Ward Flow chats commit under the same
name, and my branch was folded into the integration line twice during the window, so a plain date
filter over-counts badly. I took the exact set my branch contributed at each fold
(`git log <fold>^1..<fold>^2`), plus everything after the second fold. Two documents I edited —
`fd23-bypasses-2026-09-01.md` and `silent-transforms.md` — are shared with other chats, so **only my
own commits in them are claimed here**, not the documents as a whole.

⚠️ **I restarted mid-window and lost all memory of my own work.** Everything below is read back from
`git log` and `git show`, not recalled. Section 6 lists what I could NOT re-derive that way.

---

## 1. The clinical defects I found and fixed

These are the ones that mattered. Each was a thing the software did wrong, not a thing it merely
described wrong.

### The referral form filled in five clinical facts nobody had chosen — `26228864a`

The emergency department's "raise a referral" form started every new referral with **sex = Female,
legal status = Voluntary, cohort = Adult, security = Open, urgency = tier 3**. A clinician who
submitted without touching those fields silently recorded five clinical facts about a patient that
nobody had stated. Sex is simply wrong for anyone who is not female. Legal status is a fact about a
person's liberty.

Four lines below, a comment on a sixth field already said the right principle in plain words — _"the
clinician picks one; the software never picks one for them"_ — and it had never been applied to the
five fields above it.

All five now start blank, each menu says "Choose a…", and the submit button is unavailable, with a
stated reason, until all five are answered. The form is a real form, so pressing Enter inside a field
could have bypassed a greyed-out button; that route is guarded separately.

### A patient could vanish off the coordinator's work list — `1b86cee6e`, `13b80a07d`

If a community team said yes to the discharge-planning side of a referral, the patient dropped off
the coordinator's list — **even though the bed request nobody had answered was still sitting there.**
A patient waiting on a bed, or sitting in an emergency department waiting on a psychiatric decision,
simply stopped being visible to the person whose job is to find them one.

Fixed by ruling that an accepted _leaving_ destination never outranks a live _arriving_ one. Written
test-first: five rows of a generated table were flipped to the expected answer before the code was
touched, and the run failed on exactly those five and nothing else.

### A ward could reach the coordinator's private view, and the guard said it could not — `1e06b9304`

There is a rule that a ward may not see where else a patient was referred, and a test enforcing it by
scanning imports. The scan used a word-boundary pattern that matched `Referral` but **not**
`Referrals` — so the one function that returns every destination on a record was invisible to it. A
ward-facing file could have imported the exact thing the rule exists to withhold, and the test would
have stayed green. Both work-list functions are now pinned in each direction.

Same commit closed a second evasion: importing a whole module under one name (`import * as model`)
named no forbidden word at all and defeated the check completely.

### A raw computer token was reaching a clinical heading — `5c1dc6080`

The referral match screen's heading rendered **"RF-006 — cancelled"** — the internal code word,
lowercase, unmapped. `cancelled` is precisely the state whose meaning is that _nobody decided it_: the
request ended because somewhere else accepted first. The bare word reads exactly like a decision
somebody took. The same panel also showed a clinician the sentence _"Accepted, but no synthetic unit
matches RF-006"_ — developer language, including the word "synthetic", on a screen used to decide
about a bed.

Found by Ward Verifier walking the screens after the branch review. **No automated check caught
either.**

### An unlabelled eligibility gate rendered as raw text — `eab1b7c7f`

The bed-matching panel labels twelve eligibility checks. It held labels for eight, with a fallback
that printed the raw internal name for anything missing — so four checks displayed as `sex_mix`,
`prior_decline` and so on. Adding a thirteenth check would have silently added a thirteenth raw
token. The label list is now exhaustive and **the fallback is deleted** — the fallback was the thing
that made it silent. A new check is now a build failure.

---

## 2. Owner rulings 6, 7 and 8, built and reviewed

Run through the full subagent process — brief, implement, review, fix, re-review, whole-branch
review, one fix wave. Nine commits: `c78ffbbbe`, `8a4fb14c2`, `41d1a80c0`, `c5f697b6b`, `663b74fb9`,
`2d075bcf0`, `e8a5bdd06`.

- **Ruling 7 — a clinician can see a referral they refused.** The row used to vanish the moment they
  answered, leaving no record on their screen and nothing to check a mistake against. There is now a
  "Recently answered" section beneath the inbox, with the reason and the time.
- **Ruling 6 — a refusal shows the moment it is given.** A referral where two wards had already said
  no, with a third still pending, showed **nothing at all**. Somebody ringing round could ring a ward
  that had already refused. Both the desk table and the phone card now show each refusal with its
  reason.
- **Ruling 8 — a refusal and an automatic cancellation are worded differently.** "Refused" means a
  person looked and said no. "Cancelled" means the request ended because somewhere else accepted
  first — nobody refused, and nobody necessarily even looked. There is now one place in the code that
  spells these four sentences, and a fifth state would be a build failure rather than a blank space.

---

## 3. Documentation and guards — the part that is not features

Seventeen commits correcting things that were written down wrongly, plus two building a mechanical
guard. Highlights rather than a list:

- **`324bb502a` / `74eb259ba`** — a test that fails if the shared traps document's numbered entries
  collide. Two chats had appended entries with the same numbers twice in one night; both merges were
  textually clean, so nothing conflicted and nothing failed. The entries cross-reference each other
  by number, so a reader followed whichever copy they reached first.
- **`b21a24f12`** — four comments describing behaviour deleted on 2026-08-31 as though it were live.
  One of them documented a routine that used to _invent_ a transport escort requirement from a
  patient's legal status — a clinical judgement nobody made, displayed as though somebody had.
- **`22ce9f4ee`** — retired a test I had added one commit earlier, once a non-vacuity check showed it
  could not fail: none of the ten seeded referrals has more than one destination, so it was asserting
  nothing.
- **`f95c687fe`** — split a privacy test's fixture so a reducer change coming from another chat would
  not turn it red and block itself from landing.

---

## 4. ⚠️ Issues — my own errors, in full

Nine of my 38 commits exist only to correct something I had previously asserted. I am listing all of
them, because the pattern is more useful to you than any single one.

| Commit      | What I had got wrong                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `95ec6c702` | My own document about which screens show what had decayed — in the two ways its own opening paragraph warns about.                                                                                                                                                                                                                                                                         |
| `9051ed86a` | That document's header kept its original pinned commit through six revisions, so it vouched for content that had changed underneath it.                                                                                                                                                                                                                                                    |
| `2f2d4aae2` | The same document listed 25 surfaces. There were 26. Found only by deliberately trying to falsify it.                                                                                                                                                                                                                                                                                      |
| `b97f76623` | I had written an unfalsifiable superlative, and filed a permission as granted when it was unconfirmed.                                                                                                                                                                                                                                                                                     |
| `9368ead7c` | **The worst one.** Three false claims in comments I had written to correct _other_ false claims. One asserted that a search across every test found nothing exercising a particular case — falsified 180 lines above it in the same file. **I ran that search myself and reported the result to two other chats before it reached the comment. The search was real; its scope was wrong.** |
| `28efe0a5b` | I wrote that a measurement covered "every ward screen". I had measured **one**. Another chat's production run found the opposite result on a second screen.                                                                                                                                                                                                                                |
| `8697f6194` | I told two chats that a projection had no field allowlist. It has one — enforced by the type checker rather than the test suite, so my search in the test suite found nothing and I read that as absence. One chat had already taken my claim as its own.                                                                                                                                  |
| `b11dbc364` | Retracted a headline finding about three guards sharing a blind spot. It was false.                                                                                                                                                                                                                                                                                                        |
| `c60a26d03` | Two claims in my own restart report, written this morning, corrected the same hour: a staleness figure computed across two divergent branches rather than along a line of history (**void**), and the wrong commit credited for a fix.                                                                                                                                                     |

**And one process error, which I recorded against myself at the time (`b21a24f12`):** I dispatched a
second writing agent into this worktree while the first was still working. The commit hook inspects
the whole folder, so the two pieces of work could not then be separated, and they landed in one
commit. Neither available workaround was acceptable, so I committed them together and said so in the
message.

**The shape all of these share:** every one was a claim I had checked. The check was real; its
_scope_ was wrong, and nothing in the process compares a check's scope against the claim it is used
to support. Three of them had already been passed to other chats before I caught them — which is why
I now say what a finding rests on, not just what it concludes.

---

## 5. Questions for you — all of them, however small

1. **The referral form still pre-selects "no one-to-one nursing".** I fixed the five fields in §1 and
   deliberately left this one, because it is the same kind of assumption and your ruling on one-to-one
   nursing was open at the time. **That ruling has since come back. Should this field also start
   blank, so the clinician states it rather than the software assuming no?**
2. **Should a coordinator see a patient's suburb?** It is on the record; I did not put it on screen.
3. **Should the referral board show what an emergency-department referral is asking for?** Today it
   does not.
4. **The demo data cannot show ruling 6 at all.** All ten sample referrals go to exactly one place, so
   "still waiting, and one service has already said no" cannot happen on the running app. The
   behaviour is proved by tests driving the real engine, but **you will not see it on screen.** Do you
   want a patient referred to two places added to the sample data? That is a decision I deliberately
   did not take on your behalf.
5. **The "recently answered" list has no limit.** It is sorted by when the decision was made and now
   shows that time, but it grows forever, so "recently" stops meaning anything. **How many rows, or
   how far back?**
6. **Can an emergency department ever _accept_ a referral?** Nothing in the app can currently produce
   that, so one branch of the new wording has no way of being reached and no test. Not a fault today;
   it becomes one the day such a path is added.

---

## 6. Blocked, and unverified

**Blocked:**

1. **Ownership of one test file (`tests/ward-screen-fd23-leaks.dom.test.tsx`) is unresolved.** I asked
   four times overnight and got no answer. It is in nobody's declared set, so nobody may safely edit
   it.
2. **Whether my branch should be brought up to date before the next job.** I am 21 commits behind.
   The next job deliberately breaks production code to find out which tests catch it; doing that 21
   commits behind risks proving something about code that no longer exists. Two findings already
   decayed that way. Ward Lead is the only chat allowed to merge, so this is not mine to settle.

**Not verified — say so rather than imply otherwise:**

- **I have run no tests at all since restarting this morning.** The last measurement was
  `Test Files 146 passed (146)`, `Tests 2073 passed (2073)`, type check clean, taken before the
  restart at the same file contents. The files have not changed since, so it should still hold — but
  "should" is not a measurement.
- **The preparation for the next job is unverified bookkeeping.** Twenty-four findings enumerated;
  only one was re-checked against the current code by me. Three read-only analyses have since checked
  all 24 and found two of my figures wrong (recorded in `c60a26d03`).
- **A proof standard changed after some of this work was done.** Breaking one thing and watching a
  test go red is no longer accepted as sufficient, because when one check fails the ones below it
  never run at all. Two of my guards were explicitly rebuilt for the new standard. **I have not
  audited the rest of my work against it.**

---

## 7. Where things stand

Nothing is half-built. The working folder is clean, every piece of work is committed, and the three
rulings are complete and reviewed. What is outstanding is one triage job I have not started, the six
questions above, and the two blockers.
