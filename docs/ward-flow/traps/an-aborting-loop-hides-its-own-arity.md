# A mutation proof demonstrates at most ONE assertion per aborting loop

Found 2026-09-02, by auditing four of one night's own mutation proofs rather than anybody else's.
**Three of the four overstated what they had shown.** This is the mechanism behind the worst of them.

## The ceiling

**`expect()` throws. A throw inside a `for` propagates out of the test. Iterations after the first
failure never run.**

So:

> **Per aborting loop, per mutation run, a proof demonstrates AT MOST ONE assertion capable of
> failing. To demonstrate N assertions in a loop you need N runs.**

Not "most of them". Not "the ones that ran". **One.**

## Why iterations that ran do not count either

The tempting softening — _"the iterations before the failure did run and pass, so they are partly
covered"_ — is wrong, and it is the standing rule applied one level in:

**An assertion that stays green under a mutation that could not have reddened it is unproven by that
mutation.** Iterations before the failing one passed **because the mutation never touched them**.
They are in the same category as the iterations that never ran at all. Executing is not evidence.

**Everything before the failure is unproven; everything after it never ran.** The abort does not
create the gap — **it hides its size.**

## Why this defeats the check that was installed to catch it

The sibling rule (one mutation per assertion, not per test file) came from a run reporting
`2 failed | 2 passed` — **the unexercised assertions were visible on the face of the output**, and
the rule is the instruction to notice them.

**An aborting loop reports one failure and nothing else. There is no passer to interrogate.**
The abort removes precisely the evidence the sibling rule tells you to look for. **A proof can
satisfy that rule completely and still be three-quarters unexercised.**

**Sharper still: the output is identical whether one element is broken or all of them are.** So it
cannot report blast radius _within_ a loop at all.

## It is invisible in the source, too

```ts
for (const phrase of [...ten phrases]) {
  expect(text).not.toContain(phrase);
}
```

**Reads as one assertion. Is ten. Nothing in the shape declares its own arity.**

Same family as a throwing Testing Library query being a safety property expressed as retrieval —
see [`comments-that-reverse-a-ruling.md`](comments-that-reverse-a-ruling.md) for the general form
of a guarantee living somewhere nobody reads it as a guarantee.

## The remedy — BOTH halves, or you have moved the defect

```
expect.soft()        a single mutation exercises every iteration, and the output names each break
assert the length    an empty array cannot pass by iterating nothing
```

**Soft alone converts an under-exercised loop into a fully-exercised loop over a possibly-empty
array**, which is the same defect wearing a different costume. Ship both.

**The case for soft, in its strongest form:** it is not that ten mutations are tedious. **It is that
the per-run ceiling is one without it.** Ten mutations and one soft mutation both reach ten
assertions; only one of them is a thing anybody does twice. And soft proves the assertions fire
_together_, which is the condition the loop actually runs under, where ten separate mutations prove
they fire in isolation.

⚠️ **Boundary — state it or somebody misapplies it.** **Soft only helps when a SINGLE mutation
breaks MANY elements.** Where each element needs its own mutation to break it, soft buys nothing and
you are back to N runs. It is the right instrument for a phrase loop (`not.toContain` over ten
phrases, one reintroduction breaking several); it is the wrong one for a loop whose elements are
independent.

## Where this does NOT apply

**A generated table whose cases are separate `it` blocks is immune** — each is its own test, and an
abort in one cannot suppress another. If a proof covers a table of that shape, its blast radius is
real. Check which shape you have before discounting a proof.

## For anyone auditing a proof

**Ask the array length, not the failure count.** An assertion count is not an `expect()` count. Any
proof whose output shows a single failure over a looped assertion has demonstrated one iteration.

## The general lesson, which outlived the specific one

Of four proofs audited, **the only one that did not overstate is the one whose commit message
already declared its own limitation** — and that is not a coincidence of care. **A proof that states
what it does not cover is the only kind that cannot silently overstate, because the overstatement
has nowhere to hide.**

**So: the limitation belongs in the artefact, not in the message announcing it.** A caveat in a
commit message travels with the commit forever. A caveat in a report is read once, by one person, on
the night it was written.
