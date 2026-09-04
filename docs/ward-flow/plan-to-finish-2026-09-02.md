# THE PLAN TO FINISH WARD FLOW — 2026-09-02, late

**Written after the owner asked for the whole thing completed. Every claim below is measured, not
recalled, and the measurements name their tree: master `0539dbc51`.**

## ✅ HIS THREE NAMED REQUIREMENTS ARE ALREADY BUILT — verified from source, just now

| He asked for                                       | It is at                                   | Reachable how                                                                                            |
| -------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **A screen for each patient**                      | `/mockups/ward-flow/people/[patientId]`    | From a search-result tile, and after adding                                                              |
| **Add a new patient when the search finds nobody** | `/mockups/ward-flow/people/new`            | From the search's empty state — **and it now carries the typed name forward** (`patient-search.tsx:179`) |
| **A referral screen from a patient**               | `person-screen.tsx:120` → `/referrals/new` | The "Refer this person" control                                                                          |
| **… and standalone, anyone can reach**             | `/mockups/ward-flow/referrals`             | **In the rail**, group "board", labelled _Referral board_; the intake form hangs off it                  |

⚠️ **ONE DESIGN DECISION HE SHOULD SEE RATHER THAN INHERIT: the intake FORM is deliberately not in
the rail.** Its own note says listing a form beside Handover, Escalation and Discharges _"would
present a form as though it were a board"_, and a coordinator reaches it while looking at the queue.
**The BOARD is standalone and reachable by anyone; the form is one click inside it.** **If he wants
the form itself in the rail that is a one-line change and his call.**

## 🔴 THE ONE QUESTION THAT MUST REACH HIM — and it is not two chats disagreeing

**Two sessions asked him about the SAME FIELD and only one of them mentioned the privacy cost.**

**Ward Builder Three asked, as a SAFETY question:**

> _"Should a referral carry the patient's legal status? Today it carries only a tick-box — does this
> person need an involuntary bed? — filled in by whoever writes the referral. If that says no for
> someone who is legally detained, the system will accept them onto a ward not authorised to hold
> them, and nothing objects, because it never sees their legal status."_

**Ward Lead asked, as a PRIVACY question**, and recorded his answer as authorising exactly one new
field on `Referral` — the patient link — with legal status named among the facts that stay refused.

**He answered both yes.** ⚠️ **THAT IS NOT A CONTRADICTION IN HIM. It is one incomplete question and
one complete one, about one field.** Three said so itself, unprompted: _"he approved a safety
argument, having not been shown the privacy cost, because I did not know there was one."_

**PUT BOTH WORDINGS TO HIM. Do not ask him to adjudicate between two chats' summaries.**

⚠️ **AND THE SAFETY GAP IS REAL WHICHEVER WAY HE RULES: a referral's involuntary-bed tick-box is an
assertion by the referrer, checked against nothing.** **Following the new patient link reaches a
record that has no legal status on it either** — measured, with a control. **So both halves look
done from a distance and neither carries the fact the front door reads.**

## The work, with owners, and the file boundaries that keep them apart

| #   | Task                                                                                                                   | Owner                              | Files                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | **Stale bed count refusable; reason 3 rewritten** as _"I have confirmed the current bed state with the ward directly"_ | **Ward Builder Three**             | `ward-eligibility`, `ward-flow-reducer`, `ward-change-reasons`, the disjointness guard |
| 2   | **The patient link** — write half only, plus the person-screen copy in the SAME commit                                 | **Ward Builder Two**               | `ward-model`, `ward-flow-events`, `person-screen`, `referral-intake`                   |
| 3   | **Adversarial read of 2**                                                                                              | **Ward Builder One**               | read-only, **stating the SHA at the top**                                              |
| 4   | **Coordinator sees a patient's suburb** + **signpost the route to the receiving ward**                                 | **Ward Builder One**, after 3      | `coordinator-screen`, `ward-nav`                                                       |
| 5   | **"Recently answered" holds ten**                                                                                      | subagent                           | `referral-board`                                                                       |
| 6   | **A demo patient referred to two places at once**                                                                      | subagent                           | seed files                                                                             |
| 7   | **Re-approaching a declined ward needs no written reason** — verify it already does not                                | subagent                           | read-only                                                                              |
| 8   | **The wording page** — all thirteen lists, actual text, for him to strike or rewrite                                   | **Ward Verifier** (no tree needed) | one new document                                                                       |

## ⚠️ DELIBERATELY NOT DOING

- **`flow-diagram.tsx:167`'s display-cap misuse.** Same defect the shortlist just lost. **Changing two
  surfaces on one theory is how a fix becomes two defects.** Its own look, later.
- **Pushing anything to `origin/main`.** Far behind and untouched. **A separate decision he has not
  been asked for.**
- **The `FD-23` read** — a coordinator seeing a person's referral history. **Ruled onto a coordinator
  screen, not the person screen, and not built until the write half lands and is reviewed.**

## The rule every stream is held to

⚠️ **A measurement is not a fact until its subject is named: the UNIT, the TREE, and the MOMENT.**
Five errors in one session, all of them measuring something adjacent to the claim and reporting it as
the claim. **Every report states the SHA.**
