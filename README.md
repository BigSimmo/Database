# Clinical KB

Local-first medical guideline RAG knowledge base for a psychiatrist in Perth,
Australia. The app uploads private clinical reference documents to Supabase
Storage, indexes text and extracted image captions into pgvector, and answers
questions with source citations that link back to the original PDF/document.

## Setup

1. Use Node.js 24.x with npm 11.x. CI runs on Node 24, and `.nvmrc` /
   `.node-version` pin the same runtime for local version managers. CI also runs
   `npm run check:edge:functions`, which requires Deno v2.x.
2. Install dependencies:

```bash
npm install
```

3. Copy the full `.env.example` to `.env.local` and fill in Supabase and OpenAI
   values. Copy the worker and upload defaults too — they are conservative
   local-first settings, not optional extras.
4. Confirm the Supabase target:

```bash
npm run check:supabase-project
```

The expected live project is `Clinical KB Database`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://sjrfecxgysukkwxsowpy.supabase.co
SUPABASE_PROJECT_REF=sjrfecxgysukkwxsowpy
SUPABASE_PROJECT_NAME=Clinical KB Database
```

Do not use the older unused Supabase project `Database`
(`qjgitjyhxrwxsrydablr`). Local checks and runtime guards warn or fall back to
demo mode if that stale ref appears in `.env.local`.

5. Database bootstrap:

- **Existing `Clinical KB Database` project:** migrations are already applied on
  live. Normal local dev does not need a SQL editor bootstrap step.
- **New staging or fresh database:** link the Supabase CLI to the project, then
  apply committed migrations when local and remote histories align:

```bash
npx supabase link --project-ref sjrfecxgysukkwxsowpy
npx supabase migration list --linked
npx supabase db push
```

Treat `supabase/schema.sql` as a reconciled reference mirror, not the primary
onboarding path. For drift, repair policy, and live-only caveats, see
`docs/supabase-migration-reconciliation.md` and the retrieval RPC section in
`docs/process-hardening.md`.

6. Install Deno v2.x to run Edge Function type checks
   (`npm run check:edge:functions`). CI installs Deno automatically via
   `denoland/setup-deno`. For local use, follow the
   [Deno installation guide](https://docs.deno.com/runtime/getting_started/installation/)
   and ensure `deno --version` reports a 2.x release.
7. Install optional PDF/OCR worker dependencies:

```bash
python -m pip install -r worker/python/requirements.txt
```

8. Start the app:

```bash
npm run dev
```

The dev command uses a stable project-specific localhost port derived from this
folder path, so it does not silently reuse common ports such as `3000`, `3001`,
or `3002` from another local project. It prints the exact URL every time, for
example `http://localhost:37xx`. If the stable project port is already busy, it
uses the next free localhost port and prints that fallback URL.

For chat-driven work, use:

```bash
npm run ensure
```

This checks whether Clinical KB is already running, verifies the local server
belongs to this project, and starts the dev server in the background if needed.
When you say `run` in this chat, Codex should use this command and return the
printed URL.

9. In a second terminal, start the local ingestion worker:

```bash
npm run worker
```

The Next.js API stores uploads and queues ingestion jobs. The worker performs
heavy parsing, OCR, image captioning, chunking, embedding, and database inserts.
It uses the conservative worker defaults from `.env.example` when those vars are
set in `.env.local`.

## Environment Notes

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it in the browser.
- `SUPABASE_PROJECT_REF` must stay `sjrfecxgysukkwxsowpy` for the live
  `Clinical KB Database` project.
- Documents and extracted images are stored in private Supabase buckets.
- Initial assumptions are guideline/reference documents only, not patient
  identifiable records.
- OpenAI receives extracted document text/images for embeddings, image captions,
  and grounded answer generation.
- `MAX_UPLOAD_MB`, `CHUNK_SIZE`, and `CHUNK_OVERLAP` are deliberately
  conservative defaults for local-first indexing.

## Clinical Safety Status

- This project is a clinical reference prototype, not validated clinical
  decision support.
- Demo documents are synthetic and are not clinical guidance.
- Do not upload patient-identifiable documents unless local governance, privacy,
  and data-processing approvals explicitly allow it.
- Generated answers and copied drafts must be verified against linked source
  documents, source status, local policy, and patient context before clinical
  use.
- Production deployment needs clinical governance review, source approval rules,
  and TGA Software as a Medical Device screening where applicable.
- See `docs/clinical-governance.md` for the deployment governance checklist.

## Cursor Supabase MCP

This repo ships workspace Supabase MCP config in `.cursor/mcp.json` and agent
skills under `.cursor/skills/supabase*`. Use them for database inspection,
advisors, and docs lookup — not as a replacement for committed migrations.

1. Open **Cursor Settings → Tools & MCP** and enable the `supabase` server.
2. Complete the one-time OAuth flow in your browser. Choose the Supabase org that
   owns **Clinical KB Database** (`sjrfecxgysukkwxsowpy`).
3. Reload the window, then verify with a prompt such as: _"List tables using
   Supabase MCP."_
4. Keep **manual tool-call approval** enabled. Review SQL and migration actions
   before they run on live data.
5. Run `npm run check:supabase-project` after any Supabase env or MCP config
   change.

Defaults in `.cursor/mcp.json`:

- `project_ref=sjrfecxgysukkwxsowpy` — scoped to the live Clinical KB project
  only
- `read_only=true` — safer default for exploration and reviews

Remove `read_only=true` from the MCP URL only when you intentionally need write
access (for example `execute_sql` schema experiments). Prefer the Supabase CLI
and committed migrations for durable schema changes.

Cloud agents do not inherit desktop OAuth automatically. After merging this
config, authenticate MCP in the environment where the cloud agent runs and start
a fresh agent session.

Never put `SUPABASE_SERVICE_ROLE_KEY` or other secrets into MCP config. The
hosted Supabase MCP server uses OAuth, not repo secrets.

## Documentation

Full categorized index: `docs/README.md` (maintained docs vs point-in-time
records vs archive). The most load-bearing entries:

- `docs/codebase-index.md` — architecture and module map (start here)
- `docs/site-map.md` — generated route map (`npm run sitemap:update`)
- `docs/process-hardening.md` — verification gates, CI expectations, known limits
- `docs/testing.md` — local test safety, focused/live commands, Playwright ownership, flake policy
- `docs/clinical-governance.md` — deployment and source governance checklist
- `docs/deployment-architecture.md` — app/worker/Supabase deployment topology
- `docs/supabase-migration-reconciliation.md` — migration drift and repair policy

Run `npm run docs:check-links` to verify repo paths referenced from the
maintained docs still resolve.

## Commands

Verification gates (see `package.json` for the full chain):

```bash
npm run verify:cheap    # check:runtime + check:github-actions + sitemap:check
                        # + brand:check + check:type-scale + check:icon-scale
                        # + lint + typecheck + test
npm run verify:pr-local # closest local mirror of the PR gate: format + verify:cheap,
                        # plus conditional build/client-bundle scan and RAG
                        # fixture validation; the full unit suite runs once
npm run verify:ui       # check:runtime + required production Chromium journeys
npm run verify:release  # check:runtime + lint + typecheck + test + build + test:e2e
                        # + check:production-readiness + governance:release
                        # + eval:quality:release (needs live Supabase + OpenAI keys)
```

Use `npm run verify:pr-local -- --dry-run --files <comma-separated paths>` to
inspect which checks a change would trigger without running them.

CI is risk-scoped (`.github/workflows/ci.yml`): a `changes` job classifies
changed paths, `static-pr` always runs runtime, action-pin, CI-scope, format,
lint, and typecheck checks, and `pr-required` is the single
always-reporting required aggregate (required PR checks are Gitleaks plus that
aggregate). One full unit run with coverage, build, safety/config checks, the
production Chromium gate, and the repo-owned Supabase `db-reset-verify`
migration replay run only when their file scopes apply; UI PRs also get one
non-blocking advisory Chromium invocation. The full Playwright browser matrix
(`release-browser-matrix`) runs on `main`, `release/*`, manual dispatch, and a
weekly schedule. Docker image builds, live drift, and live eval canary checks
are path-filtered, scheduled, or manual rather than required checks for every
source-only PR.

```bash
npm run dev       # Next.js UI/API on this project's stable localhost port
npm run ensure    # check/start this project's dev server in the background
npm run start     # production preview on the same safe port selection
npm run worker    # local ingestion worker
npm run check:supabase-project
npm run check:production-readiness # run production readiness validation preflight
npm run check:production-readiness:ci # CI-safe readiness preflight (env-absent tolerant)
npm run samples   # generate synthetic upload corpus
npm run samples:check
npm run lint
npm run typecheck
npm run test
npm run test:focused -- --files src/lib/example.ts
npm run test:live # requires ALLOW_PROVIDER_TESTS=true
npm run test:coverage
npm run test:e2e
npm run test:e2e:pr
npm run test:e2e:advisory
npm run test:e2e:all
npm run test:e2e:accessibility
npm run test:e2e:chromium
npm run test:e2e:visual
npm run check:deployment-readiness
npm run format
npm run format:check
npm run build
```

You can still override the port explicitly when needed:

```bash
PORT=4200 npm run dev
npm run dev -- --port 4200
```

On Windows PowerShell:

```powershell
$env:PORT = "4200"; npm run dev
npm run dev -- --port 4200
```

When multiple chats or projects are open, use the URL printed by the command
instead of assuming a shared address such as `http://localhost:3000`.
Codex should also run `npm run ensure` before browser QA or before handing you a
local app link after meaningful frontend changes.

## Sample Corpus

Run `npm run samples` to generate synthetic documents under
`sample-documents/`. They cover PDF, DOCX, XLSX, TXT, PDF image extraction, and
a scanned-style PDF for OCR fallback testing. Upload those files through the UI
and start `npm run worker` to index them. The sample content is deliberately
synthetic and must not be used as clinical guidance.

`sample-documents/` is generated local test output and is intentionally ignored
by Git. The smaller `public/demo-documents/` set is tracked because the app uses
it for demo-mode source and image rendering when live Supabase setup is
unavailable.
