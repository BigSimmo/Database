---
name: security
description: Find and validate concrete Database security risks across secrets, input handling, authentication, authorization, storage, dependencies, and trust boundaries. Use for security review, threat analysis, or confirmed finding remediation.
---

# Security

1. Define the scoped assets, actors, trust boundaries, entry points, and attacker-controlled inputs.
2. Search for realistic exploit paths involving auth, injection, SSRF, file handling, secrets, storage, RLS, and dependencies.
3. Prove each finding with changed code, a safe local test, or deterministic static evidence.
4. Rank by impact and likelihood; avoid speculative style findings.
5. Apply only minimal, testable fixes when requested and keep live/provider validation approval-gated.
6. Report fixed, open, false-positive, and residual risks separately.
