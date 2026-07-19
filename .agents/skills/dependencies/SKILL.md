---
name: dependencies
description: Maintain Database dependencies safely by checking compatible stable versions, release notes, peer and engine constraints, old API usage, lockfile integrity, security, and focused verification. Use for dependency updates or reviews.
---

# Dependencies

1. Inspect branch, status, Node/npm versions, `package.json`, lockfile, npm configuration, and active repo processes.
2. Compare direct dependencies with stable compatible releases and group risky ecosystems coherently.
3. Read migration notes for framework, runtime, build, test, lint, database, and security-sensitive updates.
4. Search for old APIs and make only the smallest compatibility changes.
5. When an update is requested, regenerate the existing npm lockfile and verify install integrity, focused behavior, then broader local gates. Keep review-only requests read-only.
6. Do not use force flags, switch package managers, publish, deploy, or call provider APIs without approval.
