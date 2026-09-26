# Decision: The organisation check warns, rather than fails, on unplaced and moved files

- **Status:** decided 2026-09-26
- **Source:** `docs/organisation/README.md`, find "Files that are not placed yet, and entries left behind by a move, are warnings shown on the PR, never failures (owner decisions, 2026-09-26)."

In CI the organisation check fails only for problems the pull request itself introduced, never for leftovers on main or because of the date. Files not yet placed, and map entries left behind by a move, are warnings, never failures.

If this summary and the source ever differ, the source wins.
