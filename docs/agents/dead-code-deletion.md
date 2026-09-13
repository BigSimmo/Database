# Deleting Code You Believe Is Dead

<!-- BEGIN:dead-code-deletion -->

# Deleting code you believe is dead

"Nothing imports it" is necessary and **nowhere near sufficient**. On 2026-08-20 a cleanup
sweep (PR #2204) targeted ~1,644 lines on that single test and had to be walked back seven
times. Four of the survivors had zero importers and were all alive: Ward Flow's
`wallClockNow` and `movementsByStage` (named exports in a phase plan whose 55 tasks were all
unchecked), the Caring Contacts fixtures, and `bestEffortReembedRegistryRecordAfterEdit`
(`docs/rag-hybrid-findings-and-todo.md` says any future registry write route **must** call
it). A module contract whose consumer has not been written yet is indistinguishable from
debris under a reachability scan.

Before removing any exported symbol, run:

```bash
npm run check:dead-code-candidate -- --diff origin/main
```

It fails closed and refuses a candidate that is: named in a `docs/superpowers/plans|specs`
file with unchecked tasks; pinned by a committed test; present as a string literal anywhere
in `src`/`tests`/`scripts`/`worker` (a dynamic-lookup path no import graph shows);
introduced within `DEAD_CODE_RECENT_DAYS` (default 30); or assessed on a **shallow clone**,
where nothing can be dated — run `git fetch --deepen=2000` first rather than proceeding on
the weaker signal. It also warns when the symbol is mentioned in any doc, and when its file
still exports other symbols, because deleting the file is then wrong even if the symbol is not.

Do not tune the threshold or the refusal list to make an existing diff pass. The sweep's
own diff was cut back to satisfy this gate, not the other way round.

<!-- END:dead-code-deletion -->
