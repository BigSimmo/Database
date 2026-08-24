---
name: dependencies
description: Maintain Database dependencies safely by checking compatible stable versions, release notes, peer and engine constraints, old API usage, lockfile integrity, security, and focused verification. Use for dependency updates or reviews.
---

# Dependencies

Sole procedure for exact `dependency`: update stable compatible direct packages, the existing lockfile, and required compatibility code without publishing.

1. Inspect branch/upstream, worktrees/status, engines, npm config, manifest, lockfile, workspaces, CI/scripts, and racing processes. Preserve unrelated work; isolate unsafe state.
2. Use npm 11 and `package-lock.json`. Never switch managers, add lockfile types, bypass engines/peers/resolution, or force audit fixes.
3. Compare direct ranges and locked versions with stable releases. Metadata/official-note reads are allowed; provider calls, deploy, commit, and push are not.
4. Exclude prereleases unless stable requires one. Treat outdated exit codes as inventory and group peer-coupled ecosystems.
5. For major/core updates, read version-matched official guidance and peer/engine ranges. Search code/config/tests/CI for removed APIs, flags, keys, imports, and paths.
6. Update direct packages, regenerate only the existing lockfile, and make minimal compatibility edits. Stop architectural/product migrations with versions, files, steps, and gates.
7. Validate lock/install integrity; run narrow affected compile/config/unit/browser contracts and a non-mutating audit. Widen only for risk.
8. Report runtime/npm, outdated and old-to-new versions, deferrals, edits, exact checks, audit, artifacts/processes, risks, and commit/push state.
