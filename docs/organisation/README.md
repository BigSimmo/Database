# Organisation map

_Updated 2026-09-26 — first version (stage 1); Knowledge owns._

This folder is the map of which **area** of PsychSift every tracked file belongs to. The map is
logical: nothing is moved or renamed to fit it. `npm run check:organisation` keeps it honest. The
design, the audit behind it and the owner's decisions are recorded in the PR that introduced it.

## The areas

| Id                  | Area                       | Owns                                                                                                                                      |
| ------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `answer-engine`     | Answer engine              | Turning a question into a cited answer: retrieval, ranking, answer building, citation checks, the clinical-ask pipeline, the eval harness |
| `source-intake`     | Source intake and indexing | Any source becoming searchable: upload, extraction, OCR, captions, chunking, embeddings, index units, the ingestion worker                |
| `clinical-content`  | Clinical reference content | Facts a clinician reads, and where each came from: the records, their sources, sign-off and publication                                   |
| `personal-practice` | Personal practice          | The clinician's own records and tools: their logic, data and server routes (today On Call, CME/CPD, favourites, calendar)                 |
| `app-experience`    | App experience             | Every page, the shared shell, navigation, search chrome, client-side search and filtering, demo mode and offline behaviour                |
| `data-platform`     | Data platform and access   | Database schema, migrations and drift guards, auth, owner scope, privacy, environment, proxy, security headers, observability             |
| `delivery`          | Delivery and assurance     | Getting a change safely from branch to live: CI, git hooks, gates, budgets, containers, deploy config, test tooling                       |
| `knowledge`         | Knowledge and records      | How people and agents know how to work, and what has been decided or left open: entry docs, agent tooling, ledgers, records               |
| `design-system`     | Design system (workstream) | Tokens, primitives, brand, and the lint rules that enforce them                                                                           |
| `prototypes`        | Prototypes (workstream)    | Admin-only work not yet in the product: Care Plan, the developer hub, design-scratch mock-ups                                             |

Each area's file in `systems/` lists its canonical docs and its path rules.

**Loose around pages and modes (owner decision, 2026-09-26).** Areas describe the job code does, never a page or a mode; any mode named above is only an example of today's layout. Every page sits in App experience whatever mode it serves, so adding, moving, renaming or retiring a page or a mode needs no map edit.

## Placing new work

Ask: **if this file broke, which part of PsychSift would stop working?**

- A test belongs to the area it tests. A doc about one area belongs to that area. A script that serves one domain belongs to that domain's area; only generic tooling goes to `delivery`.
- A new file inside a folder the map already covers is placed automatically. A new folder, or a loose file in a mixed folder (`src/lib`, `src/components`, `scripts`, `tests`, `docs`), needs a rule: add it to the right `systems/<id>.json`. Prefer a folder or name-pattern rule over naming one file, and never name a single page.
- After moving or renaming things, run `npm run check:organisation -- --fix`. It removes entries left pointing at moved or deleted files, drops not-yet-placed entries a rule now covers and restores alphabetical order. It never places a file and never touches anything outside this folder.
- If a file genuinely does two jobs equally, list it in `shared.json` with a reason. If you honestly cannot tell, list it in `not-yet-placed.json` with a one-line reason that says where it might belong (at most 120 characters; no links, names or long numbers, because this repo is public).
- Ward Flow and Caring Contacts are being removed from the project and are listed in `ignored.json`. Delete their entries when their files go.

**Rule language.** A rule with no `*` names one exact file. `*` matches within one folder; `**` spans folders. Everything else is literal, including `(search-app)` and `[id]`, and matching is case-sensitive. An exact rule beats a pattern; otherwise the rule with the longer fixed part (the text before the first `*`) wins. A wildcard directly inside a mixed folder needs at least three fixed characters, so `tests/rag-*` is allowed and `tests/*.ts` is not.

## Running it and reading the result

```bash
npm run check:organisation              # the working tree
npm run check:organisation -- --staged  # exactly what is staged
npm run check:organisation -- --files src/lib/chunking.ts   # which area owns a file
npm run check:organisation -- --fix     # tidy the map after moving or renaming files
```

| Exit | Meaning                                                                                                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`  | Nothing the run is responsible for is broken. Warnings may be listed: unplaced files, entries pointing at moved or deleted files, superseded not-yet-placed entries, unsorted rules, patterns matching nothing. |
| `1`  | The map contradicts itself or cannot be read: invalid JSON or an unknown key, a bad reason, an over-broad rule, or two areas tying for a file.                                                                  |
| `2`  | The check could not run or could not be trusted: a crash, git missing, the wrong or a sparse checkout, a newer map version, or an unreachable CI base.                                                          |

In CI (`static-pr`), only problems the change itself introduced fail the step, so a PR is never blamed for something already on main and the result never depends on the date. Files that are not placed yet, and entries left behind by a move, are warnings shown on the PR, never failures (owner decisions, 2026-09-26).

Each local run writes a JSON and a Markdown report to the git-ignored `output/organisation/`, selected by `latest.json`. The report also lists canonical docs changed since their last-read pin in `pins.json` (re-read the doc against the code, then update its pin to the id the report prints), the most-edited files of the last 30 days, and what moved since the last report. `npm run ensure` runs the check once, advisory only, when it starts a new dev server.

## What it does not guarantee

- It does not prove any code works. It can pass while tests fail, the build is broken or the live site is down.
- Placing a file in an area is never a clinical, ranking, privacy, security, legal or database approval. Those keep their own checks (`pr-policy`, CI, the migration and drift guards) and Josh's sign-off.
- "Prototype" or "ignored" never exempts a file from any other rule.
- It does not check that a document is true, only that it exists and whether it changed since its last-read pin.
- A report means "last checked at commit X", never "currently true".
- "Not yet placed" is an honest "don't know yet", not an acceptance.
