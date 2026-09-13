# Ward Flow — the combined picture, 2026-09-02

**Assembled by Ward Lead at `b6d533ddb` from two committed chat reports and from git. Ward Builder
Two had not reported when this was written; Ward Verifier writes no files and cannot report this
way. Both gaps are marked.**

---

## First — three things I told the owner that were wrong

**1. "Messaging between chats is broken in both directions." It is not.** Ward Builder One reports
receiving substantive replies from Ward Verifier, Ward Builder Two and Ward Builder Three within the
hour, and its sends were plainly acted on — one chat opened a file at its request, another
restructured a document around a distinction it sent. **What fails is messages reaching Ward Lead
specifically.** That is a one-directional gap between one chat and the rest, and calling it general
explained away the very difference that matters.

**2. "All five chats restarted and remember nothing."** Ward Builder One and Ward Builder Three both
state their context is intact. **Ward Builder One notes its risk is different and arguably worse than
amnesia: a continuous memory of things that were true when checked and may not be true now.**

**3. `now.md` under-counts Ward Builder Three.** It says 24 commits, 89 files, 129 findings. Measured
at that branch's tip: **25 commits, 90 files, 131 findings.** The 89 was a real defect of theirs,
found and closed _after_ my row was written — I was quoting their pre-correction number.

---

## Where the work stands

**Merged on the master line — 19 commits.** Two missing clinical gates on the movement path
(`sex_designation`, then `forensic`); one-to-one nursing capacity enforced by the reducer (ruling 1);
the ward's role reduced to one spelling with a fixed vocabulary (ruling 5); a ward warned when it is
asked to take a patient failing its own rules; the ward index page's repeated identifier; an evidence
re-audit of ~45 isolating mutations across seven clinical guards finding **zero decorative
assertions**.

**Unmerged — 55 commits across three branches, all merging clean.**

| Branch             | Commits | Substance                                                                                                                                                                                                                                                                               |
| ------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ward Builder One   | 22      | ~5,150 lines: sixteen false statements on the community and statistics screens, the claims register made falsifiable, blocked discharges by blocker, elapsed time instead of a withheld date, the privacy guard widened from 23 unit names to **65 name-strings**, three trap documents |
| Ward Builder Two   | 8       | ruling 7, refusals shown on the queued board, cancelled destinations worded apart from refusals, a missing gate label made a **compile error**, a raw code word removed from a clinical heading                                                                                         |
| Ward Builder Three | 25      | sixteen unreachable production routes, the route-prefix invariant, the traps numbering guard, a comment stripper that was **destroying 1,897 characters of live code**, and two full sweeps                                                                                             |

---

## The questions, all of them, deduplicated

### Clinical and safety — the owner's decisions

1. ⚠️ **Should the engine refuse a placement nobody explicitly overrode?** Today it refuses nothing:
   `REFER_TO_UNITS`, `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` check no eligibility at all, and driving
   the real reducer placed a detained, involuntary adult male into the network's forensic bed with
   zero rejections. **Recommendation: yes, but keep the override exactly as designed** — refuse unless
   an override reason is recorded on the event.
2. **Should a shortlist show beds a ward SAYS it can staff, or beds physically empty?** The two halves
   disagree; a ruling of 2026-09-01 already chose "what the ward says" for a different action.
   Measured impact today: zero.
3. **Should the one-to-one care checkbox start unanswered, like the five fields that now do?** It
   starts unticked on the reasoning that "not required" is a real answer — defensible before ruling 1
   made ticking it consume a ward's staffing.

### Privacy — one question in five places

4. ⚠️ **Should the app have any notion of who is looking?** There is none. **Answering this settles
   5–8 below, and I would settle it first.**
5. Should the sidebar stop naming the other wards a patient was referred to?
6. Should the patient workspace stop showing how many wards were tried, and which accepted?
7. **Should a coordinator see a patient's suburb?** Raised independently by Ward Builder Three: the
   coordinator projection documents itself _"never filtered — the coordinator may see everything"_ and
   is a hand-written eleven-field list that omits `suburb`. ⚠️ **The field is in neither projection's
   type, so no gate can catch it.**
8. ⚠️ **Cross-page inference on the community hub** (Ward Builder One). 65 team pages, each listing who
   was referred to that team, all reachable from one index. **Anyone who opens two pages learns a
   person was referred to both — without the software ever displaying it.** FD-23 governs a
   _ward-scoped_ viewer; a community team page is a viewer scope nobody has defined. **Moot today only
   because every seeded referral is single-destination, which is an accident of the fixture — and the
   fixture has changed three times today.**

### Wording

9. **Is "Ward nurse in charge" the same role as "Ward manager"?** A fourth spelling, outside ruling 5.
   Changing it means rewriting a search test, not just a word.
10. **"Expected discharge was 1 week ago"** — past tense rather than the word "overdue", which an
    existing test bans page-wide. The implementer's choice, not a ruling.

### Process and housekeeping

11. **Should the empty-default ruling extend to the other pre-selected controls?** Ward Builder Two has
    found **nine**, including an ED referral form seeding sex and legal status. Ward Builder One first
    called three of them the same fault and **then corrected itself** — their values are displayed
    elsewhere, so an error is detectable. Both now recommend it as tidying, not safety.
12. **Does the claims register cover every figure, or not?** Figure 3 shipped without an entry; its
    siblings have them. Either a parity follow-up or a decision that the register is not per-figure.
13. ⚠️ **Is a count without its findings worth keeping?** Ward Builder Three's DOM sweep records **61
    findings and writes out 8**. The other **53 have no individual record anywhere** — the working
    notes died with their sessions. **Re-run to recover them, or retire the number?**
14. **How should "already fixed before it was raised" be counted?** One finding was fixed the day
    before it was reported; the analysis reproduced and the defect was real. Both builders agree it is
    not a false positive, but the hit rate depends on the answer.
15. **Do you want the 131 findings triaged at all?** See the bias below.
16. **May I clear four leftover files**, including `tests/scratch_debug_elig.test.ts` on the master
    line, whose entire body asserts that true is true? Ward Builder Three independently asked whether
    it is meant to be there.
17. **May five ordinary pages lose their loading placeholder?** ⚠️ **Not re-checked since I raised it.**

---

## ⚠️ What the chats believe but have not verified — read this before acting on any number

Both reports carry a section for this, and it is the most valuable part of each.

- **Ward Builder One: three of its own four red-proofs overstate.** One commit's claim that _"every
  pin fired"_ is false — roughly **46 of 63** claim-specific assertions were never exercised, **and
  that is a floor.** Anything resting on that commit's proof is weaker than its message reads.
- **Ward Builder Three: the structural bias, which it calls the most consequential thing it believes
  and the least tested.** Every candidate guard found so far — **six of six** — sits in a
  `.dom.test.tsx` or a `ui-*.spec.ts`, and **the `.ts` sweep read neither family.** So its 131
  findings are systematically skewed toward tests that misdescribe their own job rather than genuine
  gaps. **The inference rests on six instances and two of its own retractions.**
- **On current triage rates, roughly half of the 131 are not work at all** — five of the first ten
  triaged were not gaps.
- **A sweep's coverage is a fact about the branch it was taken on**, and staleness is temporal, not
  positional: comparing branches _as they stand now_ misses a file identical today that differed when
  it was read. Measured: 4 of 90 `.ts` files and 6 of 56 DOM files changed since their sweeps, **plus
  five production source files** — and every falsifier names a production file, often by line.
- **Ward Builder One has had its claims-register count wrong three times tonight** (74, 87, 85, now 86) and has not re-read it.
- **Ward Builder Three has one mutation that was inconclusive** — it broke the file's parse, so the
  runner reported "no tests". **That assertion has never been proved and is not claimed.**
- **Both ED browser journeys were fixed and never re-run**, because Playwright was withheld.

---

## Two gaps in this document

- **Ward Builder Two has not reported.** Its work is visible in git and is summarised above from
  commit messages, not from its own account.
- **Ward Verifier cannot report this way** — its checkout is deliberately frozen and it writes no
  file. That constraint is correct and should not be relaxed to collect a report; the answer is to ask
  it a question it can answer in a message.
