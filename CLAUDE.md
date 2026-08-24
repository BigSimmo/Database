@AGENTS.md

# Database orientation for Claude

This file is orientation only. `AGENTS.md` owns repository authority, safety, routing, and execution policy. Canonical skills and runbooks own procedures.

## Product map

Database is a psychiatry-first clinical knowledge workspace. Its app modes, routes, and user-facing ownership map are indexed in [`docs/site-map.md`](docs/site-map.md) and [`docs/codebase-index.md`](docs/codebase-index.md).

## Technical map

The application uses Next.js 16, React 19, TypeScript, Tailwind CSS, and Supabase. Exact runtime and dependency versions live in `.nvmrc`, `package.json`, and `package-lock.json`. Installed Next.js guidance lives under `node_modules/next/dist/docs/`.

## Repository map

- `src/app/`: routes, layouts, and route handlers.
- `src/components/`: shared and feature UI.
- `src/lib/`: domain logic, data access, retrieval, and utilities.
- `supabase/`: migrations, functions, and database policy.
- `tests/`: unit and contract coverage; browser journeys use repository wrappers.
- `scripts/`: verification, operations, policy, and maintenance tooling.
- `docs/`: architecture, governance, runbooks, and durable records.

## Core flow

Mode metadata and route ownership lead into app routes, feature components, domain libraries, and Supabase-backed persistence. Shared UI ownership and search/chrome wiring are documented separately so feature modules do not create parallel foundations.

## Canonical pointers

- Agent ownership and routing: [`docs/agents-guide.md`](docs/agents-guide.md).
- Verification and CI: [`docs/process-hardening.md`](docs/process-hardening.md) and [`docs/testing.md`](docs/testing.md).
- UI and search ownership: [`docs/wiring-conventions.md`](docs/wiring-conventions.md) and [`docs/search-chrome-behaviour.md`](docs/search-chrome-behaviour.md).
- Review procedure: [`docs/codex-review-protocol.md`](docs/codex-review-protocol.md).
- Cloud capability profiles: [`docs/codex-cloud.md`](docs/codex-cloud.md).
- Clinical and retrieval governance: [`docs/production-readiness-checklist.md`](docs/production-readiness-checklist.md) and [`docs/rag-behaviour/`](docs/rag-behaviour/).
- Database and deployment topology: [`docs/deployment-architecture.md`](docs/deployment-architecture.md) and [`docs/database-drift-detection.md`](docs/database-drift-detection.md).
- Canonical skills: [`.agents/skills/catalog.json`](.agents/skills/catalog.json).
