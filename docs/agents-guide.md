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
| **AGENTS.md** (canonical) | All agent rules, gates, safety boundaries                  | `AGENTS.md`; `CLAUDE.md` imports it with `@AGENTS.md` and adds orientation only (stack, layout, flows) — never a second copy of the rules                  |
| **Codex** (OpenAI)        | Primary PR code-review + automatic resolve                 | AGENTS.md "Codex review" sections, `docs/codex-review-protocol.md`, `docs/codex-prompt-playbook.md`, `.github/workflows/codex-autofix-review-comments.yml` |
| **Claude Code**           | Interactive dev; scoped review subagents + workflow skills | `.claude/` (agents, skills, hooks), `.github/workflows/claude.yml`                                                                                         |
| **Cursor**                | Editor skills + project MCP (Supabase, Context7, …)        | `.cursor/` (skills, `mcp.json`)                                                                                                                            |
| **Railway MCP**           | Deploy/logs/env **names** (project-scoped)                 | Root `.mcp.json` (`@railway/cli` mcp); needs `RAILWAY_API_TOKEN` — not `RAILWAY_TOKEN`                                                                     |
| **CodeRabbit**            | Advisory PR review (never blocking)                        | `.coderabbit.yaml` (`commit_status: false`)                                                                                                                |
| **`.agents/`**            | Home-grown single-word skill catalogue                     | `.agents/skills/catalog.json`; list with `npm run skills`                                                                                                  |

Rule of thumb: change agent behaviour in `AGENTS.md`, then let each system inherit it.
Do not add a new AI system or grow the skill count without retiring something — the
breadth is already a maintenance cost for a single maintainer. Prefer **≤5 active MCP
servers** per session (tool-schema token bloat degrades agents).

## MCP default read path (ops / docs)

Use registered MCPs before opening dashboards when the task is read-only inspection.
Writes, secret rotations, and hosted mutations stay confirmation-gated per `AGENTS.md`.

| Server                      | Config                                                                           | Use for                                                                                                                                      | Do not                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase** (read-only)    | `.cursor/mcp.json` — pinned `project_ref=sjrfecxgysukkwxsowpy`, `read_only=true` | `search_docs`, advisors, read SQL, schema inspection                                                                                         | Print secret values; raw-edit retrieval RPCs via `execute_sql`; Auth DB connection-cap (`#011`) — **dashboard only**                           |
| **Railway**                 | Root `.mcp.json`                                                                 | Deploy status, service logs, env **names**/presence                                                                                          | Confuse `RAILWAY_API_TOKEN` (personal) with CI `RAILWAY_TOKEN`; mutate without approval                                                        |
| **Context7**                | `.cursor/mcp.json` → `https://mcp.context7.com/mcp` (+ Cursor `context7-plugin`) | Versioned docs for **Tailwind 4, Zod 4, Playwright, Vitest** (and similar peers). Optional higher limits: set `CONTEXT7_API_KEY` (see below) | Next.js 16 — always use `node_modules/next/dist/docs/` (AGENTS.md). Do not invent App Router APIs from training data; never commit the API key |
| **Chrome DevTools**         | `.cursor/mcp.json` → `npx -y chrome-devtools-mcp@1.6.0`                          | CLS/LCP/console/network while implementing redesigns (`#147`, `#162`–`#164`, Therapy Compass)                                                | Don't leave it always-on with Browse + Playwright MCP (token bloat). Use for perf/debug passes                                                 |
| **GitHub Checks / Actions** | Operator approval pending                                                        | PR check visibility when `gh pr checks` returns empty totals                                                                                 | Bot `update-branch`; broaden scopes beyond Checks/Actions read                                                                                 |

### Context7 API key (optional)

1. Create a free key at [context7.com/dashboard](https://context7.com/dashboard) (`ctx7sk…`).
2. Set `CONTEXT7_API_KEY` as a **user/OS env var** or in Cursor **Settings → MCP → context7**
   env so `${env:CONTEXT7_API_KEY}` in `.cursor/mcp.json` resolves. `.env.local` alone does
   not feed Cursor MCP.
3. Reload MCP servers in Cursor. Without a key, Context7 still works at lower rate limits.
4. Prefer the Cursor `context7-plugin` / `resolve-library-id` + `query-docs` tools over raw
   `curl` to `https://context7.com/api/v2/...` unless you are debugging the HTTP API.

Never paste credential values into chat, issues, or commits. Prefer presence/length checks
(`check:local-presence`) over dumping env contents.
