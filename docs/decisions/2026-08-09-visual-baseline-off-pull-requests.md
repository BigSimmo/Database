# Decision: The visual baseline job stays off pull requests

- **Status:** decided 2026-08-09
- **Source:** `docs/testing.md`, find "owner decision on PR #1755"

The pixel-comparison visual baseline job does not run on pull requests or the merge queue, and it is not a required check. It still runs on pushes to main and release, weekly and on demand; adding it back before merge needs an explicit ask from the owner.

If this summary and the source ever differ, the source wins.
