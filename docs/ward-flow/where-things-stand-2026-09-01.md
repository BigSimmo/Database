# Where Ward Flow stands — 2026-09-01, end of the decisions day

**Measured at `c494283a9` and later.** This is the single current-state file. The three
`owner-rulings-2026-09-01-*.md` files hold the decisions and their reasoning; this holds what is built,
what is running, and what remains.

## Built and proven today

| What                                                                | Commit      | Proof                                                        |
| ------------------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| The ward board reads live state, not fixtures                       | `eec6e08fa` | a dispatch changes a rendered figure                         |
| A ward can record that a patient has left                           | —           | 11 model tests, 5 screen tests                               |
| A referrer can take back a referral                                 | `fd7adf110` | refuses closed / accepted / no-live-referral                 |
| An override register nobody could read is now readable              | `f1878c90d` | OD-3 holds by construction, independently verified           |
| ⚠️ **A patient cannot be pulled to a bed being cleaned**            | `37bc8aca3` | mutation-proven; owner re-confirmed against a contrary relay |
| ⚠️ **Admission no longer cancels the patient's discharge planning** | `610ff0bbc` | proven failing first                                         |
| Three more ways to leave, absconding guarded out                    | `c494283a9` | a test whose only job is to fail if absconding is added      |

## Remaining work, in dependency order

**In flight right now** — four agents and both peer chats:

1. **`left` → `departed`** — the fourth admission state. Five of the eight ways out are not discharges.
2. **Six bed states** — Open, Pending, Pulled, Held, Occupied, Closed. Being measured before writing.
3. **`HOLD_BED` → the PULL** — the word has been on the wrong action since it was written. Being measured.
4. **The notification machinery** — being measured. **Six owner requirements land on it and it does not exist.**
5. **The statistics screen** (Ward Builder) — coordinator-only, two real figures and two honest empty states.
6. **Independent review of Builder's four finished tasks** (Ward Verifier) — Task 1 already confirmed.

**Queued, not started:**

7. **The cancellation moves from acceptance to the pull.** ⚠️ Must rewrite `ward-referral-visibility.ts:44-50` in the same change — it documents the ward inference as firing at acceptance, which stops being true.
8. **Waitlisting at many wards**, the pull cancelling the rest, and a ward removing a patient from its own list.
9. **A journey can begin at a community team.** Confirmed twice. Patient entry precedes referral; the transport booking hangs off the patient record.
10. **`BOOK_TRANSPORT` widens to ED, ward AND community.**
11. **A community team can refer to another community team.** The owner flagged this as important and previously missed — a patient moves house and changes catchment, and the whole team list derives from a catchment document.
12. **ED refers to community follow-up, declinable, and returns to the ED as an open item if declined.**
13. **Absconding as its own shape** — an admission that continues while the patient is absent, bed held, no timer, released by a person as `did-not-return`.
14. **Repopulate the community hub** — deliberately empty until 9 lands.
15. **Route maps + nav entry for the statistics screen** — Ward Lead's, after Builder's page exists.
16. **Merge Ward Builder's branch.** ⚠️ Known conflict in `ward-management-modes.tsx`; Ward Lead resolves it.
17. **Capture the pending → open duration** so the statistics screen can stop showing an empty state.

**Held for the owner:**

18. **What the two confirm buttons should actually do.** They currently say "coming soon", which he approved as a holding position.

## Closed today, and not to be reopened

- **The two independent clinician checks — PASSED.** He obtained the answers from two other people.
- **A ward may refer to another psychiatric ward** — reversed from this morning's ruling.
- **ED-to-ED and ward-straight-to-a-general-hospital** — deliberate absences, not gaps.
- **Police and ambulance** — not a pathway; those patients arrive and ED medical doctors refer them.

## ⚠️ The one process rule that came out of today

**A relayed owner decision is a prompt to CONFIRM, never a decision to act on.** Three of four decisions
that reached Ward Lead through a third party arrived altered — every one in good faith, every one
would have cost real work. Confirming costs one question.
