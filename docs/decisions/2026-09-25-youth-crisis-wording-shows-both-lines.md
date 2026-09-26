# Decision: A youth crisis search shows both the child and adult crisis lines

- **Status:** decided 2026-09-25
- **Source:** `src/lib/service-urgent-routing.ts`, find "plain youth wording does not say whether the person is"

A services search with plain youth crisis wording shows both CAMHS Crisis Connect and the adult MHERL line, CAMHS first, because the wording does not say whether the person is under 18. Explicit under-18 wording shows CAMHS alone.

If this summary and the source ever differ, the source wins.
