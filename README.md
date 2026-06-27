# Clinical KB

Local-first medical guideline RAG knowledge base for a psychiatrist in Perth,
Australia. The app uploads private clinical reference documents to Supabase
Storage, indexes text and extracted image captions into pgvector, and answers
questions with source citations that link back to the original PDF/document.

## Setup

1. Use Node.js 24.x with npm 11.x. CI runs on Node 24, and `.nvmrc` /
   `.node-version` pin the same runtime for local version managers.
2. Copy `.env.example` to `.env.local` and fill in Supabase and OpenAI values.
3. Confirm the Supabase target:

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

4. Run `supabase/schema.sql` in the `Clinical KB Database` Supabase project SQL
   editor.
5. Install Deno v2.x to run Edge Function type checks (`npm run check:edge:functions`).
   CI installs Deno automatically via `denoland/setup-deno`. For local use, follow the
   [Deno installation guide](https://docs.deno.com/runtime/getting_started/installation/)
   and ensure `deno --version` reports a 2.x release.
6. Install optional PDF/OCR worker dependencies:

```bash
python -m pip install -r worker/python/requirements.txt
```

7. Start the app:

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

7. In a second terminal, start the local ingestion worker:

```bash
npm run worker
```

The Next.js API stores uploads and queues ingestion jobs. The worker performs
heavy parsing, OCR, image captioning, chunking, embedding, and database inserts.

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

## Commands

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
npm run test:coverage
npm run test:e2e
npm run test:e2e:all
npm run test:e2e:accessibility
npm run test:e2e:chromium
npm run test:e2e:visual
npm run verify:cheap
npm run verify:ui
npm run verify:release
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
