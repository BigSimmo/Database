# Cursor Cloud Specific Instructions

<!-- BEGIN:cursor-cloud-instructions -->

## Cursor Cloud specific instructions (not Codex Cloud)

Durable notes for Cloud Agents. Standard commands live in `README.md` and `package.json`; only non-obvious caveats are captured here.

Environment observations below are historical setup guidance. Verify the current
runtime, dependency parity and authorised service state before relying on them.
Configuration examples and command descriptions are not current execution evidence;
the repository's provider boundary applies to live mode and documentation providers.

- Context7 peer-library documentation and credential setup are described below; use the bundled Next.js documentation for Next-specific APIs. Project MCP is local `@upstash/context7-mcp@3.2.5` with `CONTEXT7_API_KEY` from env/Secrets. If the host-injected Context7 MCP returns quota exceeded, use `npx ctx7 library "your-query"` or `npx ctx7 docs "your-query"` with the same secret — do not invent peer APIs from training data.
- Runtime: the app hard-requires Node >=24.15.0 <25 / npm 11.x (`engine-strict`; the preinstall and runtime gates enforce the minor floor, while `scripts/dev-free-port.mjs` rejects other majors). A compatible Node 24 is installed via nvm and symlinked into `/usr/local/cargo/bin` (first entry in `PATH`) so `node`/`npm` resolve to it in every shell. If a shell ever resolves `/exec-daemon/node` (v22) instead, prepend the installed nvm Node 24 bin to `PATH` (for example `"$HOME/.nvm/versions/node/v24.18.1/bin"`; run `ls "$HOME/.nvm/versions/node"` to confirm the exact patch version).
- Live vs demo mode: `isDemoMode()` (`src/lib/env.ts`) does **not** switch solely on whether secrets are present. It returns true when `NEXT_PUBLIC_DEMO_MODE=true` (explicit override in every environment), and in non-production it also falls back to demo when required Supabase config is missing **or** `checkSupabaseProjectConfig` reports a project mismatch — even if some OpenAI/Supabase vars are set. Production never silently falls back (missing/mismatched config fails loudly). Live mode against `Clinical KB Database` is available only when the explicit demo override is off, project validation passes, and the required secrets are present (set them as Cloud Agent **Secrets** so they inject into `.env.local`/`process.env`): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PROJECT_REF`, `SUPABASE_PROJECT_NAME`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`), `SUPABASE_SERVICE_ROLE_KEY` (accepts the `sb_secret_…` secret key), `OPENAI_API_KEY`. Keep `RAG_PROVIDER_MODE=auto` so OpenAI is used with graceful source-only fallback. When live mode is unavailable in dev, the app uses the synthetic corpus in `src/lib/demo-data.ts` / `public/demo-documents/`. `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` power CI env-check and Playwright.
- Live-mode caveat: `RAG_PROVIDER_MODE=auto` attempts OpenAI (fast → strong route); if generation fails the built-in quality gates it silently degrades to a deterministic "Source-only" answer that still cites real documents — this is expected, not a failure. Anonymous answer requests are supported for the public corpus; signed-in access is scoped to the caller. Check `src/lib/public-api-access.ts` and `src/lib/owner-scope.ts` for the access rules; a server-side endpoint does not grant access to private documents.
- What still won't run in this VM even with secrets: `npm run worker` also needs the Python OCR stack (`worker/python/requirements.txt`) and heavy parsing deps; Supabase edge functions need Deno v2.x + deployment. `verify:release` additionally runs governance/eval gates. Treat missing-secret failures of `check:supabase-project`/`verify:release` in demo mode as expected, not regressions.
- Dev server: `npm run dev` selects a stable per-project localhost port (e.g. `4461`), binds `0.0.0.0`, and prints the exact URL. Never assume port 3000/3001/3002. `npm run ensure` starts/verifies it in the background.
- Verification without secrets: `npm run lint`, `npm run typecheck`, and `npm run test` (vitest) are intended local checks; select the relevant tier and report the actual outcome rather than assuming a pass. `npm run verify:cheap` also runs runtime, GitHub Actions pin, CI-scope, and sitemap checks. `npm run verify:pr-local` selects checks by changed paths: recognised documentation scopes use focused static checks, while executable or unknown scopes include lint, typecheck and the full unit suite, plus applicable build/domain checks. Inspect uncertain scope with `npm run verify:pr-local -- --dry-run`; do not run `verify:cheap` first merely to repeat coverage. Browser, Docker/Supabase, audit, and provider checks remain separate. See `docs/testing.md` for lock, live-test, Playwright, and flake-ledger rules. If `check:installed-lock-parity` or `check:playwright-browser-revision` reports Playwright/image drift (`#255`), do not force a mismatched Chromium path — leave browser proof unverified until the appropriate authorised environment supplies it (see `docs/testing.md` § Testing speed playbook).
- For GitHub-related work authorised in this session, prefer the connected GitHub connector/MCP tools first for PR, issue, comment, review-thread, and Actions tasks they support (including run/job/log/artifact inspection and review-thread replies/resolution). A missing `gh` CLI is not a blocker for connector-supported work; never add a PAT as a workaround. The intended connection is `BigSimmo` with repository write access. Reserve administrator access for separately approved operations. Verify the exact target and connector result before any write. Ordinary authorised shell `git` branch publication remains allowed; use shell `gh` only for a genuine connector gap and only when the task permits it.

<!-- END:cursor-cloud-instructions -->

For Next.js APIs, read the version installed under `node_modules/next/dist/docs/` as required by AGENTS.md. For peer libraries, use version-matched documentation; the checked-in MCP configuration defines the intended integration. The setup notes below describe configuration, not permission to call a provider or proof that a hosted connector is authenticated.

## Context7 setup and peer-library documentation

1. When account setup is authorised, obtain a key through [the Context7 dashboard](https://context7.com/dashboard). Check the account's current terms and limits there.
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
   If host MCP is quota-blocked, use `npx ctx7 library "your-query"` or `npx ctx7 docs "your-query"` (or the project local MCP
   after reload) — do not invent APIs from training data.
4. **Does not expand project MCP `${env:}`:** `.env.local` alone (Next app / env.ts path).
5. **Reload MCP servers after key changes.** The stdio child captures env at spawn time — setting
   or rotating `CONTEXT7_API_KEY` has no effect until you reload MCP (or restart Cursor).
6. **Keyless / lower rate limits:** when `CONTEXT7_API_KEY` is unset, Cursor expands
   `${env:CONTEXT7_API_KEY}` to an empty string and the server runs anonymously. If MCP logs
   ever show the literal placeholder `${env:CONTEXT7_API_KEY}` as the key value, remove the
   `env` object from the `context7` entry (anonymous) or set a real key, then reload MCP.
7. Prefer `resolve-library-id` → `query-docs` when the authenticated MCP path is available;
   otherwise use the authorised local CLI path. Never expose keys in command output or chat logs, including during debugging.

Never paste credential values into chat, issues, or commits. Prefer presence/length checks
(`check:local-presence`) over dumping env contents.
