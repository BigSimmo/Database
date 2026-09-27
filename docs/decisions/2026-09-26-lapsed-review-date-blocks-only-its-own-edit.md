# Decision: A lapsed review date blocks only a change that edits that item

- **Status:** decided 2026-09-26
- **Source:** `docs/organisation/README.md`, find "Yes, block on a lapsed review date only when the change edits that item."

On a pull request, in the merge queue or on a push to main, an expired review date on the clinical hazard or privacy register blocks only when the change edits that expired entry, or touches a file the entry covers. Editing some other part of the register gives a warning instead, so a safety change is no longer held up by unrelated lapsed dates. If the check cannot compare the entry, any change to the register still blocks. Local runs, other branches and release gates stay strict.

If this summary and the source ever differ, the source wins.
