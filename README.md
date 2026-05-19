# Clinical KB

Local-first medical guideline RAG knowledge base for a psychiatrist in Perth,
Australia. The app uploads private clinical reference documents to Supabase
Storage, indexes text and extracted image captions into pgvector, and answers
questions with source citations that link back to the original PDF/document.

## Setup

1. Copy `.env.example` to `.env.local` and fill in Supabase and OpenAI values.
2. Run `supabase/schema.sql` in your Supabase project SQL editor.
3. Install optional PDF/OCR worker dependencies:

```bash
python -m pip install -r worker/python/requirements.txt
```

4. Start the app:

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

5. In a second terminal, start the local ingestion worker:

```bash
npm run worker
```

The Next.js API stores uploads and queues ingestion jobs. The worker performs
heavy parsing, OCR, image captioning, chunking, embedding, and database inserts.

## Environment Notes

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it in the browser.
- Documents and extracted images are stored in private Supabase buckets.
- Initial assumptions are guideline/reference documents only, not patient
  identifiable records.
- OpenAI receives extracted document text/images for embeddings, image captions,
  and grounded answer generation.
- `MAX_UPLOAD_MB`, `CHUNK_SIZE`, and `CHUNK_OVERLAP` are deliberately
  conservative defaults for local-first indexing.

## Commands

```bash
npm run dev       # Next.js UI/API on this project's stable localhost port
npm run ensure    # check/start this project's dev server in the background
npm run start     # production preview on the same safe port selection
npm run worker    # local ingestion worker
npm run samples   # generate synthetic upload corpus
npm run samples:check
npm run lint
npm run test
npm run test:e2e
npm run test:e2e:chromium
npm run test:e2e:visual
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
