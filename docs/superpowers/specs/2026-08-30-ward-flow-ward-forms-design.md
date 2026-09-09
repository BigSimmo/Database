# The ward forms — design

**Status:** design complete, nothing built. **Designed from Ward Verifier's browser report**
(`PROC-19`). ⚠️ **Which surface these are was genuinely open and is now settled: they are the WARD
SCREEN's three forms, not the referrals intake** — the intake is filled in by a **referrer**, which
is the wrong person entirely.

**The three:** Confirm capacity · Flag bed coming free · Record leave bed.

## What is already right, and must survive the pass

**Measured, not assumed: four selects, eight inputs, six fieldsets, ZERO textareas.**

⚠️ **That is the no-free-text rule holding under measurement rather than assertion**, and it is the
single most valuable property these forms have. **A design pass that adds a "notes" field to any of
them destroys the thing that makes them safe** — and a notes field on a ward form is the most natural
addition anybody could propose.

**`FD-13` permits exactly one story field in the entire product, on a referral. Not here.**

## The problem

**Three plain stacked controls with no hierarchy, and nothing indicating which one a nurse touches
every day.**

⚠️ **They are not equally important and the system already knows it.** **`DB-10` says the capacity
confirmation is the daily one.** So the hierarchy these forms lack **has an answer waiting in a
decision already made** — this is not a judgement call.

## The design

**One daily action, two occasional ones.**

### Confirm capacity — the daily form

**Primary, opened by default, first on the screen.** It is the thing a nurse does on every shift, and
it should cost one glance and one confirmation, not a hunt among equals.

⚠️ **Its confirmation is what makes every other screen's bed count trustworthy** — the coordinator's
"nobody has accepted", the network diagram's eligible wards, the daily sheet. **All of them read a
number this form is the source of.** **The form should say so**: a ward confirming capacity is not
doing paperwork, it is the act that makes the rest of the system true.

### Flag bed coming free · Record leave bed — the occasional forms

**Secondary. Present, reachable in one action, not competing for the eye.**

**These are event-driven — a nurse opens them because something happened, so they do not need to be
found; they need to be there when looked for.** ⚠️ **Which is the opposite of the daily form, and the
reason a flat stack of three serves none of them.**

## What must NOT change

- ⚠️ **Zero textareas.** **Verified today. Any pass that ends with a textarea in these forms has
  broken the product's central safety property**, whatever else it improved.
- **Every value a chosen option from a fixed list**, derived from its exported array, **never
  hand-listed** — `ed-screen.tsx`'s hand-written `COHORT_OPTIONS` silently omitted `"Youth"`, and
  widening the union could never have failed.
- **No invented figure.** No default bed count, no suggested number, no "usual" value pre-filled.
  ⚠️ **A pre-filled figure is an invented figure that a tired person confirms.**
- **No name, date of birth, address or narrative history.** `PD-1` widened what a **Patient** record
  may hold; **it did not touch these forms**, and `address` and history remain denied everywhere —
  **silence is not permission.**

## Open, and not to be closed by building

- ⚠️ **Whether confirming capacity should be REQUIRED once per shift, and what happens if it is
  not done.** **The system's other screens depend on it being current** — so a stale confirmation
  quietly degrades the coordinator hub and the network diagram, **and neither of them can tell.**
  **Not ruled on. And any "overdue confirmation" indicator needs a shift boundary, which is a
  figure the owner supplies** (`P9-D6` set midnight for a different clock; **do not reuse it here
  by analogy**).
- **Whether "flag bed coming free" and the discharge prediction on the daily sheet are the same
  fact entered twice.** ⚠️ **If they are, one of them is the source and the other must derive** —
  two places for one fact is the shape the changeable-data rule refuses.
