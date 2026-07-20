# Security Policy

Clinical KB (`psychiatry.tools`) is a private, single-maintainer clinical reference
application that handles private guideline documents and grounded answer generation.
Security reports are taken seriously and handled privately.

## Reporting a vulnerability

**Please do not open a public issue, pull request, or discussion for a security
problem, and do not disclose it publicly before it is resolved.**

Report privately using **GitHub Private Vulnerability Reporting** — the
**"Report a vulnerability"** button under this repository's **Security** tab
(`Security → Advisories → Report a vulnerability`). If that channel is unavailable to
you, contact the maintainer (`@BigSimmo`) directly through GitHub.

When reporting, please include:

- A description of the issue and its impact.
- Steps to reproduce (a minimal proof of concept is ideal).
- Affected paths, routes, or components if known.
- Any suggested remediation.

You can expect an initial acknowledgement within a few days. Because this is a
single-maintainer project, timelines are best-effort; please allow a reasonable
period for a fix before any disclosure.

## Supported versions

The application is continuously deployed from `main`. Only the current `main` /
production deployment is supported — there are no maintained release branches or
backports. Fixes land on `main` and roll out via the standard deployment path
(`docs/deployment-architecture.md`).

## Scope

In scope: the Next.js app tier, API routes, the ingestion worker, Supabase
schema/RLS/RPCs, and the retrieval/answer pipeline in this repository.

Out of scope: third-party managed services themselves (Supabase, OpenAI, Railway,
GitHub) — report those to the respective vendor. Note this is a clinical **prototype**,
not validated clinical decision support (see `README.md` → "Clinical Safety Status").

## Handling sensitive findings

- Never include real secrets, credentials, tokens, or patient-identifiable data in a
  report. Reference the affected file/location and the class of exposure instead.
- Do not run intrusive tests against the live `psychiatry.tools` deployment or the live
  Supabase project. Prefer local/demo mode (`README.md` → Setup).

## Related security documentation

- `docs/rag-injection-threat-model.md` — prompt-injection threat model.
- `docs/tenancy-defense-in-depth-review.md` — multi-tenant isolation review.
- `docs/privacy-impact-assessment.md` — privacy impact assessment and launch blockers.
- `docs/clinical-hazard-analysis.md` — clinical hazard register.
- `docs/openai-cross-border-basis.md` — cross-border data-processing basis.

Automated controls in CI: secret scanning (Gitleaks, `.github/workflows/secret-scan.yml`)
and static analysis (Semgrep, `.github/workflows/sast.yml`).
