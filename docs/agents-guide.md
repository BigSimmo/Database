# Agents Guide

Short onboarding pointer. Root [`AGENTS.md`](../AGENTS.md) is the authoritative
router for precedence, authority, safety, shortcuts, and high-risk invariants.
Detailed procedures have one canonical owner under `.agents/skills/` or in the
runbook named by that router. This page only orients you; it does not duplicate
operative rules.

## Read in this order

1. [`AGENTS.md`](../AGENTS.md) — authority, lifecycle, evidence vocabulary,
   shortcut routing, verification tiers, and safety boundaries.
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
- Before handoff, select one risk-matched gate: use focused checks for bounded
  changes, `npm run verify:cheap` for cross-module offline risk, or
  `npm run verify:pr-local` for PR-ready executable/unknown scope. Do not stack
  broad gates on unchanged content; see [`docs/process-hardening.md`](process-hardening.md).

## AI tooling map

This repo intentionally uses several AI systems. Every system defers first to
[`AGENTS.md`](../AGENTS.md), then loads the canonical procedure named there.

| System                    | Owns                                                         | Where it is configured                                                                                                                    |
| ------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **AGENTS.md** (canonical) | Stable authority, safety, routing, invariants                | `AGENTS.md`; `CLAUDE.md` imports it and must not duplicate procedures                                                                     |
| **Codex** (OpenAI)        | Primary PR review + human-invoked repair; marker resolution  | `docs/codex-review-protocol.md`, `docs/codex-prompt-playbook.md`, `.github/workflows/codex-autofix-review-comments.yml`                   |
| **Claude Code**           | Interactive dev; scoped review subagents + workflow skills   | `.claude/` (agents, skills, hooks), `.github/workflows/claude.yml`                                                                        |
| **Cursor**                | Editor agents/adapters + project MCP (Supabase, Context7, …) | `.cursor/` (agents, skills, `mcp.json`)                                                                                                   |
| **Railway MCP**           | Desktop/CLI template; hosted app is separate                 | Root `.mcp.json` / `.codex/config.toml` use `https://mcp.railway.com` with OAuth; hosted ChatGPT/Codex requires a workspace-installed app |
| **CodeRabbit**            | Advisory PR review (never blocking)                          | `.coderabbit.yaml` (`commit_status: false`)                                                                                               |
| **`.agents/`**            | Home-grown skill catalogue                                   | `.agents/skills/catalog.json`; list with `npm run skills`                                                                                 |

Rule of thumb: change stable authority or routing in `AGENTS.md`; change execution
steps in the one canonical skill/runbook. Compatibility adapters link to that owner;
`.cursor/agents/pr-babysit.md` is an adapter, not a second Run PR procedure.
Prefer **≤5 active MCP servers** per session (tool-schema token bloat degrades agents).

## MCP default read path (ops / docs)

Use registered MCPs before opening dashboards when the task is read-only inspection.
Writes, secret rotations, and hosted mutations stay confirmation-gated per `AGENTS.md`.

| Server                      | Config                                                                                                                                                                        | Use for                                                                                                                                                                            | Do not                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Supabase** (read-only)    | `.cursor/mcp.json` — pinned `project_ref=sjrfecxgysukkwxsowpy`, `read_only=true`                                                                                              | `search_docs`, advisors, read SQL, schema inspection                                                                                                                               | Print secret values; raw-edit retrieval RPCs via `execute_sql`; Auth DB connection-cap (`#011`) — **dashboard only**                             |
| **Railway**                 | Desktop/CLI: root `.mcp.json` / `.codex/config.toml` (`railway` + OAuth). Hosted ChatGPT/Codex: workspace-installed app only — repository MCP files are not a read path there | Deploy status, service logs, env **names**/presence (Desktop/CLI MCP or hosted app tools)                                                                                          | Treat root `.mcp.json` as hosted proof; confuse `RAILWAY_API_TOKEN` (personal) with CI `RAILWAY_TOKEN`; mutate without approval                  |
| **Context7**                | `.cursor/mcp.json` → `npx -y @upstash/context7-mcp@3.2.5` (+ Cursor `context7-plugin`)                                                                                        | Versioned docs for **Tailwind 4, Zod 4, Playwright, Vitest, React 19, `@supabase/supabase-js`** (peers; not exhaustive). Local stdio reads `CONTEXT7_API_KEY` from env (see below) | Next.js 16 — always use `node_modules/next/dist/docs/` (AGENTS.md). Do not invent App Router APIs from training data; never commit the API key   |
| **Chrome DevTools**         | `.cursor/mcp.json` → `npx -y chrome-devtools-mcp@1.6.0`                                                                                                                       | CLS/LCP/console/network while implementing redesigns (`#147`, `#162`–`#164`, Therapy Compass)                                                                                      | Don't leave it always-on with Browse + Playwright MCP (token bloat). Use for perf/debug passes                                                   |
| **Figma**                   | Cursor Figma plugin + `.cursor/mcp.json` → `https://mcp.figma.com/mcp` (OAuth); Codex Desktop/CLI template in `.codex/config.toml` stays disabled unless locally opted in     | Desktop Cursor: capture live UI, read/write frames, Make context, Code Connect                                                                                                     | Cursor Cloud Agents do not inherit Desktop OAuth. Treat Make as exploration; product truth is `docs/design-system/` + gates; keep ≤5 active MCPs |
| **GitHub Checks / Actions** | Connector/native task controls plus necessary low-cost read-only metadata for a named repository or PR                                                                        | PR/check visibility when `gh pr checks` returns empty totals                                                                                                                       | Hosted writes, reruns, thread mutation, sensitive reads, or scopes beyond the named target without separate approval                             |

### Context7 API key (optional)

1. Create a free key at [context7.com/dashboard](https://context7.com/dashboard) (`ctx7sk…`).
2. **Project MCP (checked-in):** `.cursor/mcp.json` runs pinned local
   `@upstash/context7-mcp@3.2.5` with `env.CONTEXT7_API_KEY: ${env:CONTEXT7_API_KEY}` so the
   stdio child receives the key when Cursor expands it (Cursor filters inherited env for MCP
   children — the explicit `env` pass-through is required). Set the key as a **user/OS env var**
   or in Cursor **Settings → MCP → context7**.
3. **Cursor Cloud Agent Secrets:** inject `CONTEXT7_API_KEY` into the agent shell
   `process.env`. That authenticates **local** Context7 (`npx @upstash/context7-mcp` /
   `npx ctx7`) and project stdio MCP after reload. It does **not** authenticate a separate
   **host-injected** Context7 connector — measured 2026-08-05: host `resolve-library-id`
   still returned monthly quota exceeded while the same key worked for `npx ctx7 library …`.
   If host MCP is quota-blocked, use `npx ctx7 library|docs …` (or the project local MCP
   after reload) — do not invent APIs from training data.
4. **Does not expand project MCP `${env:}`:** `.env.local` alone (Next app / env.ts path).
5. **Reload MCP servers after key changes.** The stdio child captures env at spawn time — setting
   or rotating `CONTEXT7_API_KEY` has no effect until you reload MCP (or restart Cursor).
6. **Keyless / lower rate limits:** when `CONTEXT7_API_KEY` is unset, Cursor expands
   `${env:CONTEXT7_API_KEY}` to an empty string and the server runs anonymously. If MCP logs
   ever show the literal placeholder `${env:CONTEXT7_API_KEY}` as the key value, remove the
   `env` object from the `context7` entry (anonymous) or set a real key, then reload MCP.
7. Prefer `resolve-library-id` → `query-docs` when the authenticated MCP path is available;
   otherwise `npx ctx7`. Avoid raw `curl` with keys in chat logs unless debugging.

Never paste credential values into chat, issues, or commits. Prefer presence/length checks
(`check:local-presence`) over dumping env contents.
