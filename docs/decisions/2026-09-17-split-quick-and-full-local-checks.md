# Decision: The quick local check was split from the full one

- **Status:** decided 2026-09-17
- **Source:** `docs/process-hardening.md`, find "Split on 2026-09-17 (owner decision)."

The quick local check (`verify:cheap`) was cut back to the lockfile check, lint, type checks and unit tests, and the 38 static consistency checks moved to `verify:full`. Every one of them still runs in CI.

If this summary and the source ever differ, the source wins.
