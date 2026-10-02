# Decision: The quick local check was split from the full one

- **Status:** decided 2026-09-17
- **Source:** `docs/process-hardening.md`, find "Split on 2026-09-17 (owner decision)."

The quick local check (`verify:cheap`) was cut back to the lockfile check, lint, type checks and unit tests, and the static consistency checks moved to `verify:full`. At the split that static set was **38** gates; the live count is whatever `npm run check:gate-manifest` reports against `verify:full:internal` (41 static as of 2026-09-30). Every one of them still runs in CI.

If this summary and the source ever differ, the source wins.
