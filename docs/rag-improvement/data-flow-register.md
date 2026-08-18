# RAG data-flow register

**Status:** maintained register, created 2026-08-17 by programme packet S4 (B0). This is the
Gate A artefact named by [README.md](README.md) §B0 and §"Gates A–F": every input, process and
sink that clinical text or a query can reach, what is retained there, for how long, and whether
de-identified data is permitted. Gate A is satisfied when this register is complete, canary
strings are absent from every sink, and the owner has signed off before any new vendor or
provider use.

It is a register of **where data goes**, not a threat model and not a privacy policy. Where a
sink's behaviour is enforced by code, the enforcing module is named so a reviewer can check the
claim rather than trust it.

**Scope note.** "Clinical text" here means the content of uploaded reference documents, which
are clinical guidelines rather than patient records. The system is not designed to hold patient
data, and the register treats any patient identifier reaching a sink as an incident, not as an
expected category — that is what the adversarial fixtures' canary strings exist to detect
(`scripts/fixtures/rag-adversarial-cases.v1.json`).

## 1. Inputs

| Input                    | Source                                 | Contains clinical text?      | Contains identifiers?                       | Notes                                                                                                   |
| ------------------------ | -------------------------------------- | ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Uploaded document        | Owner, via `/api/upload`               | Yes — full document          | Should not; not machine-verified at upload  | Lands in the private `clinical-documents` bucket. Owner-scoped from the first write (`owner-scope.ts`). |
| Search / answer query    | Owner, via the search shell            | Free text, owner-authored    | Possible — a typed query is unconstrained   | `query-privacy.ts` governs what may be persisted about a query.                                         |
| Adversarial fixture case | This repository, hand-authored         | Synthetic only               | Canary strings only, never real identifiers | Enforced by `check:rag:adversarial-fixtures`: synthetic titles, real-source denylist, canary registry.  |
| Golden retrieval fixture | This repository                        | Real document titles / terms | No                                          | `scripts/fixtures/rag-retrieval-golden.json`; ground truth for the 36-case gate.                        |
| Environment / secrets    | Railway, Supabase, `.env.local` in dev | No                           | No                                          | Never committed; `check:codex-cloud` and the raw-env boundary script guard agent-shell exposure.        |

## 2. Processes

| Process                | Module                                               | Data seen                     | Leaves the machine?               | Retention                            |
| ---------------------- | ---------------------------------------------------- | ----------------------------- | --------------------------------- | ------------------------------------ |
| Extraction / OCR       | `worker/main.ts`, `worker/python/`                   | Full document bytes and text  | No                                | Temp paths, see §3                   |
| Image captioning       | `src/lib/openai.ts` via the worker                   | Page images                   | Yes — OpenAI                      | Provider-side, see §4                |
| Embedding              | `src/lib/openai.ts`                                  | Chunk text, query text        | Yes — OpenAI                      | Provider-side, see §4                |
| Retrieval              | Postgres RPCs, `src/lib/rag/**`                      | Query + owner scope           | No — inside Supabase              | Row lifetime                         |
| Answer generation      | `src/lib/rag/rag.ts` → OpenAI                        | Query + selected excerpts     | Yes — OpenAI                      | Provider-side, see §4                |
| Verification / gating  | `answer-verification.ts`, `rag-claim-support.ts`     | Draft answer + excerpts       | No                                | In-process only                      |
| Offline evaluation     | `eval:rag:offline`, `check:rag:adversarial-fixtures` | Fixtures only                 | No — network-free by construction | None beyond stdout                   |
| Adversarial validation | `scripts/rag-adversarial-contract.mjs`               | Synthetic fixtures + canaries | No                                | None; report is scanned for canaries |

## 3. Sinks and retention

| Sink                                                             | What lands there                                  | Retention                                                          | De-identified data permitted?                | Enforcement / notes                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supabase Storage (`clinical-documents`)                          | Original uploaded files                           | Until the owner deletes the document                               | N/A — originals are the product              | Private bucket; access is owner-scoped and signed-URL mediated.                                                                                                                                                                                                                      |
| Postgres tables (chunks, pages, images, embeddings, index units) | Derived clinical text and vectors                 | Until reindex or document deletion; reindex commits per generation | N/A — derived from the owner's own documents | `reindex-pipeline.ts` commits atomically per generation.                                                                                                                                                                                                                             |
| `rag_response_cache`                                             | Generated answers keyed by query + prompt version | Until invalidated by a prompt-version bump or eviction             | Yes                                          | Generation fallbacks are excluded from the cache (`#231`), so a degraded answer cannot be served later.                                                                                                                                                                              |
| `rag_queries` / answer telemetry                                 | Query metadata, routing, gate reasons, latency    | Operational retention                                              | Yes — metadata only                          | `query-privacy.ts`. Packet B1 (shipped 2026-08-17): extended fields flow only through the allow-listed numeric projection in `src/lib/rag/rag-answer-telemetry-metadata.ts` behind `RAG_TELEMETRY_EXTENDED` (default false), pinned by `tests/rag-telemetry-canary-absence.test.ts`. |
| `ingestion_jobs` / `document_index_quality`                      | Job state, quality gate outcomes                  | Job lifetime + audit history                                       | Yes — metadata only                          | No document body text.                                                                                                                                                                                                                                                               |
| Worker temp paths                                                | Extracted text, page images, OCR intermediates    | Process lifetime; removed when the job completes or fails          | N/A — transient                              | Container-local. A crashed job must not leave text behind; this is the register's weakest verified claim and is called out in §5.                                                                                                                                                    |
| Application logs / Sentry                                        | Errors, stack traces, structured diagnostics      | Provider retention                                                 | Yes — metadata only; never excerpt text      | `docs/error-tracking.md`. Excerpt text must never be attached to an event.                                                                                                                                                                                                           |
| CI artifacts (GitHub Actions)                                    | Eval reports, Playwright traces, coverage         | GitHub's artifact retention                                        | Yes — aggregates only                        | Eval reports are aggregate; canary literals must not appear (Gate A).                                                                                                                                                                                                                |
| Local eval output / stdout                                       | Gate counts, case ids, aggregate metrics          | Session only                                                       | Yes — aggregates and ids only                | `check:rag:adversarial-fixtures` scans its own report for canaries before printing it.                                                                                                                                                                                               |
| Repository files                                                 | Fixtures, baseline record, docs                   | Permanent (git history)                                            | Synthetic only                               | The adversarial dataset is synthetic-only by contract; a real source name is a hard validation failure.                                                                                                                                                                              |

## 4. Provider egress

| Provider            | What is sent                          | Purpose                     | Retention / logging                                                                                                        |
| ------------------- | ------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| OpenAI — embeddings | Chunk text, query text                | Vector generation           | Provider-side; the ZDR and prompt-cache questions are open operator debt (`#053`).                                         |
| OpenAI — captions   | Page images                           | Image captions for indexing | As above.                                                                                                                  |
| OpenAI — generation | Query + selected excerpts + prompt    | Grounded answer generation  | As above.                                                                                                                  |
| Supabase            | All of §3's database and storage rows | Primary data tier           | Project `Clinical KB Database` (`sjrfecxgysukkwxsowpy`); Australian residency and the DPA are open operator debt (`#053`). |
| Railway             | Application logs and runtime metrics  | Hosting                     | Provider retention.                                                                                                        |
| GitHub Actions      | CI artifacts (§3)                     | Verification                | GitHub artifact retention.                                                                                                 |

No adversarial fixture is ever sent to a provider: the fixtures exist for offline validation
(packet B2), and both the validator and the planned offline runner are network-free.

## 5. Known gaps

These are recorded rather than resolved, because closing them is other packets' or the owner's
work. Gate A sign-off must account for them explicitly.

1. **Worker temp-path cleanup on abnormal termination is asserted, not proven.** No test kills a
   worker mid-extraction and asserts the temp tree is empty. Until one exists, treat the
   retention claim in §3 as design intent.
2. **Provider retention terms are unexecuted.** OpenAI/Railway DPAs, the ZDR decision, and
   Australian data residency are open under ledger `#053`. Until they land, §4's retention column
   is "provider default", not a contracted term.
3. **Upload does not screen for identifiers.** Nothing at `/api/upload` detects a patient
   identifier inside an uploaded document. The system's design assumption is that uploads are
   guidelines, not records; that assumption is unenforced.
4. **Telemetry canary-absence tests — closed by packet B1/S5 (2026-08-17).**
   `tests/rag-telemetry-canary-absence.test.ts` proves contaminated inputs cannot push a
   registered canary token through the telemetry projection or the generation-quality answer
   shape, and `tests/rag-adversarial-harness.test.ts` asserts every persisted `rag_queries`
   row is canary-free for all 24 adversarial cases. The adversarial validator's own report
   scan remains the boundary for the fixture-report sink.
