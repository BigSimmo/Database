# Changeable data — one place per fact

**Owner instruction, 2026-08-29, stated twice and widened the second time:**

> "The number of beds will change later… it is only example data for now. I will tell you the exact
> number of beds for every ward at a later date so make it easy to edit and add the correct number at
> a later time."
>
> "Implement a rule across the project for all data that may be liable to change i.e. wards,
> distances, options, names of locations, bed numbers etc… make it very easy to edit and change these
> parts so they can be edited in the future when I put in real parts, **and also to allow real parts
> changing in real life as well… i.e. building another hospital or more beds.**"

## Two change events, not one

The second clause is deliberate and it is the harder half.

1. **The one-off swap** — invented data replaced by real data, once.
2. **The permanent one** — a ward opens, a hospital is built, a bed count moves, a service renames.
   This never stops happening.

**Design for the second and the first comes free.** A design that survives only the swap is a design
that is obsolete the first time somebody builds a ward.

## The rule

**Every changeable real-world fact is written in exactly ONE place, and everything else derives from
it. Screens read facts; screens never state them.**

This extends the existing convention — network facts live in the seed files only — from the network
to every changeable kind: ward and hospital names, bed numbers, locations, regions, travel bands, and
every pick-list.

## The distinction that stops this rule doing damage

**"Just derive everything" is the obvious answer and it is partly wrong.** There are three kinds of
number here, not two, and collapsing them would delete guards that are working.

### 1. Authored — a human states it about the world

One place, and one place only. `beds: 20` is the ward's capacity; nothing computes it. Ward names,
site codes, regions, travel bands, and every fixed list belong here.

### 2. Derived — computable from authored facts, and never written down

If it can be computed it is computed, every time, in one exported function that every surface calls.
The `availableNow` formula currently written out in three modules with a comment asking future
readers not to let them drift is precisely what this category exists to prevent — **a comment is not
a constraint.**

### 3. Independently authored ON PURPOSE, with a real check between them

**This is the category that a naive "derive everything" rule would destroy, and it must be named
explicitly.** `ward-admissions-seed.ts` deliberately does not derive itself from `sexMix`, and its own
doc comment says why: a fixture that derived itself from the number it is checked against **could
never disagree with it**, and the check would become a check that cannot fail — this project's
signature defect.

**AND THERE IS A SECOND REASON, which matters because the first one alone invites a clever fix.**
The obvious repair to the check-that-cannot-fail problem is to invert the dependency: author the
occupants and derive `sexMix` from them. It sounds clean, it was proposed, and it is wrong.

**`sexMix` is not fixture data. It is live runtime state.** `ward-flow-reducer.ts:653` increments it
every time somebody is admitted:

```
sexMix: { ...unit.sexMix, [movement.sex]: (unit.sexMix[movement.sex] ?? 0) + 1 }
```

A `sexMix` derived from the seed would therefore be correct at page load and **wrong the moment
anybody moves in the demonstration.** Deriving it honestly would mean deriving it from the live
admissions — which stops the unit model and the admissions model being two things that agree, and
makes them one thing. Eight files under `src` read `sexMix` today. That is a design change, not a
refactor, and it is not what "make the data easy to edit" was asking for.

**So category 3 carries two loads, not one:** it keeps the check able to fail, *and* it keeps a
fixture-time number and a runtime number distinct. Anyone competent reading this rule will have the
derive-from-occupants idea; it is wrong twice.

**The test for which category a number belongs to:**

> **If a test asserts that two numbers agree, those two numbers must be authored independently.
> Otherwise, derive.**

That single question resolves every case, and it means the rule cannot be used to justify deleting a
guard.

### A fourth thing that looks like duplication and is not

`empty` and `allocatable` are not bare numbers — each carries `source`, `confirmedAt` and
`staleAfterMinutes`. They model **what a ward reported and when**, which is allowed to disagree with
what the model expects; that disagreement is the entire freshness mechanism and the reason the
capacity board can say a ward has not restated its numbers. **Do not "simplify" these into
derivations.** They are observations with provenance, not copies of a computed value.

## What this means concretely, measured today

One unit record in `ward-sites.ts` hand-states eight numbers: `beds`, `empty.value`,
`allocatable.value`, `held`, `blocked`, `sexMix.Female`, `sexMix.Male`, `speciallingCapacity` — and
`ward-admissions-seed.ts` lists that unit's occupants one line each. The identity that must hold:
**occupants + empty = beds**, and **sexMix sums to occupants**. For RPH Adult Secure today that is
9 + 9 = 18 occupied, 2 empty, 20 beds.

**So changing one bed count is not one edit**, and missing one of the others makes the app disagree
with itself with nothing going red. That is the problem this rule exists to solve.

**What is needed:** a single check asserting the identity holds for every unit, so the disagreement
cannot be silent. Not a derivation — a check, sitting between numbers that stay independently
authored, exactly as category 3 requires.

### The failure message is half the feature

**The person who will hit this check is the owner, typing real bed numbers into a file.** A red
assertion reading `expected 26 to be 20` tells a psychiatrist nothing at all, and a check whose
failure cannot be acted on is a check that gets deleted.

**The message must name what else to change, in plain words**, not merely report a mismatch:

> *RPH Adult Secure: `beds` is 26 but the parts add to 20 — 18 occupied, 2 empty, 0 out of service.
> Update `sexMix` (currently 9F + 9M) and add 6 occupants to the seed, or change `beds` back.*

That is the difference between a guard that helps him and a guard that stops him. The ward board
session is building exactly this message in `tests/ward-board-consistency.test.ts` for the board's
slice of the identity — **point at that as the worked example rather than restating the requirement
here**, because a specification drifts from an implementation and this rule should not hold two
versions of one idea.

## The owner-facing half

**When the real numbers arrive, he sends a plain list. Getting them into shape is our job, never
his.** He is never asked to format anything, to match an existing structure, or to know which places
a number lives in. A list of wards and bed counts in any form he finds convenient is a complete
hand-over, and reshaping it is the work.

**The same applies to a change in the real world.** "Armadale has six more beds" should be one edit
in one place, and everything that follows from it should follow.

## What this does NOT authorise

- **It does not authorise deleting any check.** If a rule change would make a test unable to fail,
  the rule is wrong for that case — see category 3.
- **It does not authorise flattening provenance.** A reported observation with a source and a
  timestamp is not a duplicate of a computed value.
- **It does not authorise touching the approved lists.** The stay bands, the blocker list, the
  receiving-time options, the override reasons and the follow-up options are owner-approved verbatim.
  Making them *easy to edit* means one authored location; it does not mean any agent may edit them.

## Status

**Written on `claude/Wardquestions`, not applied.** The natural home for the permanent version is
`AGENTS.md`, which exists on every branch — editing it now is the same add/add hazard that made the
fold dangerous, one level up. **This is handed to the fold session to land afterwards**, alongside the
seam and data-boundary contracts it is a sibling of.

The concrete mapping — every place a ward, distance, location name, pick-list or bed number is
currently stated, and what adding a whole new hospital would touch — is being measured by the ward
board session and is not asserted here in advance of it.

**A scope decision is with the owner, in three tiers**, put to him by the fold session. Tier 3
unifies the unit model and the admissions model, which is the design change described above rather
than a tidy-up, and he has not previously been told its cost. **Nothing in this rule presumes his
answer**, and the rule stands whichever tier he chooses — it describes how facts are held, not how
many of them there are.

## A document states a fact about now, or a record of what was true then — and they need opposite treatment

**Added 2026-08-29, at the merge session's request, after eight documents were found saying the
network has 22 units when the code has had 23 since Phase 7.** The list was the easy part. Deciding
what to do with each entry is where the damage happens, because **the two kinds look identical on the
page and the correct action for one is the harmful action for the other.**

### 1. A fact about now — correct it

`docs/ward-flow-context.md:231` says the network is *"17 sites, 8 emergency departments, 22 units"*.
That is a claim about the present. It is wrong. **Fix it, and no provenance is lost**, because a
statement about now has no provenance to lose — it was only ever a mirror of the code.

### 2. A record of what was true then — date it, never correct it

A phase plan saying *"Phase 1 shipped a bed grid that failed to reconcile on 10 of 22 units"* is not
wrong. **It is a true statement about a past event**, and the 22 is part of what makes it true.

**Correcting it to 23 back-dates a record, and back-dating destroys the only thing that makes
documents evidence rather than decoration.** This project has already been saved by exactly that
provenance: a handover instructed a reader to undo a decision the owner had made nine hours earlier,
and it was caught because the documents still said when each thing was believed. **A corpus of
silently-updated documents cannot catch that**, because every document agrees with the present and
none of them can be checked against it.

**So: add the date and the basis. Never the new number.**

### 3. The trap between them — a measurement whose basis moved but whose number did not

The sharpest case, and the one where the tidy fix is actively false.
`docs/superpowers/specs/2026-08-25-...-phase-4-...-design.md:66` records **337 eligible pairs measured
across 22 units**. Re-measured today it is **342** — and computing it *without* the 23rd unit **also
gives 342**. The extra ward accounts for none of the change.

**So renumbering 22 to 23 there would not merely preserve a stale figure. It would assert a false
cause** — telling every future reader that adding a unit moved the number, when something else did.
The same shape sits in `tests/ward-scenarios.test.ts:26`, whose dated measurement predates the 23rd
unit by two days.

**Re-measure, never renumber.** A number and its stated basis are one claim, not two, and editing
half of it manufactures a causal story nobody checked.

### The test, when it is not obvious which kind you are holding

**Ask what happens to the sentence if the code changes again tomorrow.** If it becomes wrong, it is a
fact about now — maintain it. If it stays true, it is a record — date it and leave it. If you cannot
tell, it is written ambiguously, and **the fix is to rewrite it as one or the other rather than to
update the number.**

### And the mechanical remedy, because none of the above is a habit anyone can be relied on to keep

**A change that absorbs, renames, or grows a shared fixture updates the documents naming it in the
same commit** — the way adding a route updates the site map in the same commit. Every instance found
today was correct when written and decayed at an identifiable commit that did not carry the
documents with it. **"Be careful with stale figures" cannot be checked; "the same commit" can.**

## A stated requirement is refined away by a later message answering a different question

**Written 2026-08-29 after the ledger session caught the ward board dropping a requirement nobody had
decided against.** The owner asked for a triage bar carrying six figures **and a toggle**. His
requirement appears in his **first** message. His **second** message, answering a different question
about the same bar, mentions the six figures and not the toggle — and the second message became the
version everyone worked from. **The toggle was on its way out with no one having chosen to drop it.**

**The mechanism, and it is not carelessness:** the most recent statement on a subject is normally the
best one, so "use the latest" is a good default. It fails silently when the later message was
**answering a narrower question** — it is not a revision, it is a partial restatement, and it looks
exactly like a revision.

**The rule: a later message narrows a requirement only when it says so.** Silence about a previously
stated element is not removal of it. **If a restatement omits something, treat the element as still
required and ask** — one sentence, and it costs nothing to be told yes.

**How to hold it in practice:** keep the requirement pinned to **the message that first stated it**,
with its date, and treat every later message as an amendment that must name what it changes. That is
the same discipline as the fact-versus-record rule above, applied to instructions instead of figures:
**a requirement is a record of what was asked, not a running summary of the latest conversation.**

**This is a sibling of the undated-verbatim-list trap** — both are cases where a document faithfully
reproduces something true and loses the one piece of context that makes it usable.

