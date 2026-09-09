# Controls that fired, and certified the wrong thing

**One level past "a control proves only the case you thought of".** Here the controls were real, they
executed, they passed for the right reason — **and they could not have distinguished a working
detector from a broken one.** Every one of them exercised the same easy shape.

---

## What happened

A privacy detector asked whether a forbidden place name appeared in some text. It used a word-boundary
match, `\b<name>\b`, for every name.

**Three positive controls guarded it, and all three were good tests:**

```
`Withdrawn — a bed was confirmed at ${site.name}.`
`Withdrawn — bed confirmed at site ${site.code}.`
`Withdrawn — the patient was redirected to ${ed.name}.`
```

⚠️ **Look at what every one of them ends with. A full stop.** So a word boundary always existed after
the place name, and the boundary rule always worked.

**The identical detector in a sibling file read a DOM `textContent` instead — where sibling elements
concatenate with no separator, so the text reads `…Emergency DepartmentWF-013…`.** The character
after "Department" is `W`. Both sides are word characters. **No boundary exists there and the pattern
cannot match. The detector returned "no place named" while the place was rendered on the screen.**

**That broken copy reached the master line and ran there for part of 2026-09-02.**

---

## ⚠️ Why the controls could not save it

**They were not weak, careless or vacuous. They fired. They tested the real function against real
register data, and they were right.**

**But every one of them supplied text where the two candidate rules — boundary-match and
contain-match — give the SAME answer.** A control can only discriminate between hypotheses that
disagree on its input. **Three controls that all agree on the same input are one control, run three
times.**

**The count looked like coverage. Three positive cases, one negative control, every category
represented. It was one case wearing three hats.**

---

## The distinction worth keeping

- **A vacuous control** never runs, or runs against an empty set. **Detectable by asking "did this
  execute?"**
- **A control that certifies the wrong thing** runs, passes, and means nothing. ⚠️ **Not detectable
  by any question about execution — only by asking what would have to differ for it to fail.**

**The second is worse, because everything you would normally check comes back healthy.**

---

## What catches it

**Ask of each control: what is the OTHER hypothesis, and does this input separate them?**

- ⚠️ **If you cannot name a plausible wrong implementation that this control would also pass, it is
  discriminating. If you can, it is decoration.** Here the wrong implementation was "use `\b` for
  everything", and all three controls passed it happily.
- **Vary the SHAPE of the input, not the VALUE.** All three controls varied which register the name
  came from — a unit, a code, an ED. **None varied what followed the name, which was the only axis
  that mattered.** Register coverage looked like variety and was not.
- **A boundary case belongs where a boundary exists.** The rule was about text boundaries; not one
  control put the name at a boundary that behaves unusually.
- **When the same function exists in more than one place, the copies are each other's controls.**
  This was found because one copy was exercised against DOM text and the others were not. ⚠️ **That
  was luck. The copies have since been merged into one, which removes the luck and the divergence
  together.**

---

## The uncomfortable part

**I wrote the concatenation regression case into the sibling file the same afternoon I found the
defect — and then wrote a third copy of the detector, in a third file, still without one.** The lesson
had been learned as a fact about one file and not as a property of the function.

⚠️ **A lesson recorded in the place it was learned does not travel to the next instance. That is why
this entry names the RULE — vary the shape, not the value — rather than the file.**

---

## Its relatives

Same night, four chats, one family: **the check ran, returned cleanly, and answered something
adjacent.** A `grep -E` with unsupported escaping returning a confident nought; a type read to a
guessed line range that silently cut five of eleven fields; nine mentions of a branch name counted and
reported as a failing test; a theme measured before the page had reloaded, giving a true reading of a
stale state.

**And the one that cannot be repaired, only checked for: `git add` staging nothing, printing nothing,
exiting 0.** The others are defects. That one is the tool behaving correctly.

**This entry is the family's subtlest member, because it is the only one where the check was
CORRECT — correctly written, correctly run, correctly passing — and still worthless.**
