# Agents Guide

Short onboarding pointer. The authoritative, always-current rules for agents
working in this repository live in the root [`AGENTS.md`](../AGENTS.md) —
verification gates, provider confirmation boundaries, Supabase project safety,
review routing, and workflow shortcuts. This page only orients you; it does not
duplicate those rules, so it cannot drift from them.

## Read in this order

1. [`AGENTS.md`](../AGENTS.md) — agent rules, verification gates, shortcuts
   (`upload`, `dependency`, `bug-hunter`), and safety boundaries.
2. [`docs/codebase-index.md`](codebase-index.md) — architecture and module map.
3. [`docs/README.md`](README.md) — index of all runbooks, governance docs, and
   plans, with maintained vs historical classification.
4. [`docs/site-map.md`](site-map.md) — generated route map.

## Human quickstart

- Node 24.x / npm 11.x are hard requirements (`engine-strict`); the app is
  Next.js 16 + Supabase + OpenAI.
- Copy `.env.example` to `.env.local` and fill in values (never commit
  secrets). Without Supabase/OpenAI values the app runs in demo mode on a
  synthetic corpus.
- `npm run ensure` starts or verifies the dev server on a stable
  project-specific port (never assume `localhost:3000`).
- `npm run worker` runs the local ingestion worker in a second terminal.
- When adding environment variables, update the schema in `src/lib/env.ts` and
  document them in `.env.example`.
- Before handing off changes: `npm run verify:cheap` first, then
  `npm run verify:pr-local` when the change is PR-ready (see
  [`docs/process-hardening.md`](process-hardening.md) for the full
  verification pyramid).

## AI tooling map

This repo intentionally uses several AI systems; the overlap is by design, not
accident. [`AGENTS.md`](../AGENTS.md) is the single source of truth — every system
below defers to it, so rules live in one place and cannot drift.

| System                    | Owns                                                       | Where it is configured                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AGENTS.md** (canonical) | All agent rules, gates, safety boundaries                  | `AGENTS.md`; `CLAUDE.md` is a one-line `@AGENTS.md` import                                                                                                 |
| **Codex** (OpenAI)        | Primary PR code-review + automatic resolve                 | AGENTS.md "Codex review" sections, `docs/codex-review-protocol.md`, `docs/codex-prompt-playbook.md`, `.github/workflows/codex-autofix-review-comments.yml` |
| **Claude Code**           | Interactive dev; scoped review subagents + workflow skills | `.claude/` (agents, skills, hooks), `.github/workflows/claude.yml`                                                                                         |
| **Cursor**                | DB inspection via Supabase MCP; editor skills              | `.cursor/` (skills, `mcp.json`)                                                                                                                            |
| **CodeRabbit**            | Advisory PR review (never blocking)                        | `.coderabbit.yaml` (`commit_status: false`)                                                                                                                |
| **`.agents/`**            | Home-grown single-word skill catalogue                     | `.agents/skills/catalog.json`; list with `npm run skills`                                                                                                  |

Rule of thumb: change agent behaviour in `AGENTS.md`, then let each system inherit it.
Do not add a new AI system or grow the skill count without retiring something — the
breadth is already a maintenance cost for a single maintainer.
