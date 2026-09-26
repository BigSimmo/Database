# Decision: Closing a CME year freezes a snapshot that can be amended

- **Status:** decided 2026-09-23
- **Source:** `docs/cme/design/cme-design-decisions.md`, find "decision replaces an irreversible lock with an immutable snapshot"

Closing a CME year freezes an immutable snapshot that can later take dated amendments with a reason, instead of an irreversible lock. The next year's targets are confirmed again, and hours never carry forward.

If this summary and the source ever differ, the source wins.
