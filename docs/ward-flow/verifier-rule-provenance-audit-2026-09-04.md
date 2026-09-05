# Ward Verifier — rule provenance audit, 2026-09-04

Commissioned after `R-2026-09-04-G` withdrew spec D4 (_"THIS BOARD RECORDS AND SHOWS. IT SUGGESTS
NOTHING"_) on the grounds that it **was never an owner ruling** — it was inferred, hardened into
emphatic comments across four source files, enforced by tests, and obeyed by every session that met
it, including the one that wrote the rulings document.

Question: **for every other hard rule in this codebase, can it be traced to a ruling, or did we
invent it?**

All measurement at ref `258f08fc8`.

---

## 🔴 THE HEADLINE IS A METHOD FINDING: CITATION STATUS IS NOT PROVENANCE

Both sweeps report, per rule, whether its comment or test **cites** an authority. That is the
obvious thing to triage on, and it is **wrong in both directions**. Of the two rules I traced
end-to-end myself:

| rule                                                                                   | cites an authority? | actually ruled?   |
| -------------------------------------------------------------------------------------- | ------------------- | ----------------- |
| `ui-ward-coordinator.spec.ts:735` — _"Nothing is allocated until a human refers"_      | **NO**              | **YES — ruled**   |
| `ui-ward-coordinator.spec.ts:267` — _"The score must never read as clinical severity"_ | **NO**              | **NO — inferred** |

Two uncited rules, opposite provenance. **So the ~43 uncited rules cannot be triaged by their
citation status — each one has to be traced.** An audit that sorts on "cites a ruling" would have
marked both of these the same way, and marking the first one INFERRED is the dangerous direction:
somebody would then be free to remove a constraint the owner actually gave.

### The two traces

**RULED.** `R1`, `owner-rulings-2026-09-02-afternoon.md`, direct owner quote:

> **"Keep advising and let the clinician decide!"**
> Settles A1, the largest open item in the project. The engine does not enforce placement and **it is
> not going to.**

and reaffirmed as the surviving half of `R-2026-09-04-G`: _"the software never makes a clinical
decision on its own. The final acceptance comes from the users."_ The test enforcing it cites
nothing.

**INFERRED.** MEASURED: **zero** owner rulings anywhere in `docs/ward-flow/**` mention _severity_ or
_acuity_. The only hits in the whole tree are a design mockup, a process-audit transcript, a verifier
register and an example JSON — none of them a ruling. The source's own comment
(`ward-priority.ts:101`) shows it as the project's reasoning about a number it built.

---

## 🔴 THE WITHDRAWN RULE IS STILL PROMISED TO THE CLINICIAN

`R-2026-09-04-G` demands a specific distinction of **"every comment in this area"**:

    DESCRIPTION   "this board does not rank wards"      — true today, and fine to write
    INSTRUCTION   "this board MUST NEVER rank wards"    — withdrawn, and must not be written

and records that _"the four source files carried the second and were read as binding. They have been
corrected to the first."_

**The rendered banner still carries the second.** `escalation/escalation-board.tsx:48-52`:

> This board is **not a medical device**. It records and shows what has already happened … and
> nothing more. **It never ranks** a ward the patient does not fit, and it **never states** what
> would need to change for one to work.

MEASURED: `"never ranks a ward"` is asserted by **0 tests**; the banner's testid appears in **0
tests**; the sentence exists in exactly **1** place, the component itself. **15 ward screens** carry
a "not a medical device" claim to the user.

⚠️ The paragraph offers _"it never ranks"_ as support for _"not a medical device"_ — a reader takes
them as one claim. The ruling records the regulatory position: _"A board that ranks wards for a
patient is closer to clinical decision support than one that records what happened. The TGA/SaMD
classification box was left unticked on PR #2597 for exactly this reason … It needs answering before
this ships to anyone, not before it is prototyped."_

**The correction reached four comments and missed the one sentence a clinician reads.** That is a
clinical-governance decision for the owner, not a wording fix.

⚠️ **STATUS: ESCALATED-TO-OWNER. Nobody edits that file.** It is not a defect to be repaired by a
session; the claim it makes is about regulatory status and it is the owner's to rule on.

⚠️ **And Ward Lead's framing of it is better than "one sentence was missed", because it says where
the next miss will be:** the ruling demanded the distinction of _"every comment in this area"_, and
records that four source files were corrected. **So the correction had a defined scope, it was
executed faithfully within that scope, and the scope itself was wrong — comments only.** Any future
withdrawal scoped to comments will miss the same class again.

⚠️ **And I endorsed the D4 retirement as "the template" before finding this** — having read the
header comment and not the copy forty lines below in the same file. Third time tonight I checked the
artefact I was looking at rather than the one the clinician sees.

**The retirement template, amended.** Withdrawing a rule means: (1) the comment records the
withdrawal and its ruling; (2) **the user-facing copy asserting it is found and changed**; (3)
anything pinning either is updated. Step 2 is the only one a clinician can see.

---

## SCOPE — THIS IS A SAMPLE, AND A ROW'S ABSENCE MEANS NOTHING

Stated so no reader mistakes silence for a clean bill:

| sweep        | covered                                      | population                                                                                      |
| ------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| ruling index | **20 documents read in full**, ~15 partially | ~130 files under `docs/ward-flow/**`                                                            |
| source rules | **34 rules extracted**                       | **1030 lines** carrying the project's `⚠️` marker, **507** in bolded capitals, across 175 files |
| test rules   | **42 rules**, ~20 files read in depth        | 215 files; 183 had signal hits                                                                  |

Roughly **95–100 owner-attributed rulings** were indexed; roughly **43 of the 76 extracted rules cite
no authority at all**. The test sweep names **6 further files carrying allowlist/ban-list constants
it did not open**, and reports itself as a lower bound.

**Both calibration controls passed**, which is the only reason the numbers above are worth anything:

- **Control A (must resolve to RULED):** the coordinator-override ruling, direct owner words, found
  in `the-engine-enforces-nothing.md` — a file nobody would reach by grepping `owner-*`.
- **Control B (must resolve to NOT RULED):** D4's _"suggests nothing"_, found in source and in zero
  ruling documents except the one withdrawing it.

⚠️ **Two scoping traps, both of which manufacture false INFERRED verdicts:**

1. The ruling corpus is **wider than `docs/ward-flow/owner-*`** — Control A proves it.
2. **Six id conventions across ~17 documents**; only **9** rulings use the modern
   `R-2026-MM-DD-X` form and all 9 are from 09-04. Anything keyed on that format sees one day.

---

## THE ASYMMETRY THAT SETS THE BURDEN OF PROOF

Ward Builder One's formulation, and it governs how this audit must be read:

**A wrong RULED verdict is self-correcting** — the next person goes looking for the ruling and cannot
find it. **A wrong INFERRED verdict is self-reinforcing** — it gets adopted, acted on and cited, and
the humility of _"we made this up"_ is exactly what protects it from being re-checked.

**So the burden of proof is heavier on the INFERRED side, which is the opposite of how it feels.**
Every INFERRED verdict here states the directories searched, not just the conclusion.

⚠️ **And provenance is not soundness.** A rule can be **inferred and correct**; a rule can be **ruled
and superseded by a better mechanism**. A finding of INFERRED says who decided, and nothing about
whether the constraint is right. Finding that nobody ruled something is **not** a mandate to do the
opposite — which is the same error, in reverse, that put D4 in capitals across four files.

---

## WHAT IS NOT DONE

The remaining ~41 uncited rules are extracted and quoted but **not traced**. Each needs the same
end-to-end search the two above got. I am not classifying them from citation status, for the reason
this document opens with.

---

## HOW THIS LIST MUST BE RENDERED, AND WHY IT IS NOT A PRESENTATION DETAIL

Two axes, in **separate columns**, never combined into one verdict string:

    PROVENANCE   RULED <id> | INFERRED | UNTRACEABLE
    REMEDY       MATCHES | SUPERSEDED | CONCERN-GONE | NOT-ASSESSED

⚠️ **`NOT-ASSESSED` is not a weak `INFERRED` and must not be renderable as one.** A page of rows
reading "INFERRED / NOT-ASSESSED" will be read as _"forty rules nobody can defend"_, which is the
false-INFERRED failure at scale — self-reinforcing, adopted, and cited. `NOT-ASSESSED` means only
that nobody has yet asked whether the remedy is still the right mechanism.

⚠️ **`UNTRACEABLE` is not `INFERRED` either.** Untraceable means the search did not find a ruling;
inferred means the record shows a session reasoning its way to it. D4 is INFERRED — its own withdrawal
records it being invented. A rule whose origin nobody can locate is a different and weaker claim.

**The population figures belong at the top of the page, not in a covering note** — a note is dropped
the moment the list is pasted somewhere else, and the list without its denominators reads as a census.
