# Outstanding P2/P3 Remediation Programme Design

**Date:** 2026-08-23  
**Scope:** The 55 P2/P3 ledger rows supplied in the 2026-08-23 task attachment.  
**Base:** Fresh `origin/main` at programme start, rechecked before each collision-prone batch.

## Objective

Resolve every supplied row to one of three truthful end states:

1. **Closed with evidence** — current main already satisfies the row, or the programme lands the smallest permanent fix and the required acceptance evidence exists.
2. **Implemented, awaiting an external gate** — all safe repository work is complete, but production, provider, physical-device, clinician, or elapsed-time evidence is still required.
3. **Explicitly deferred with a durable owner and trigger** — no speculative code is justified until a named feature, observation, or policy event occurs.

Only state 1 queues `issues:done`. States 2 and 3 queue an evidence-rich `issues:update` when the current row does not already express the remaining gate accurately. Feature worktrees never edit `docs/outstanding-issues.md` directly.

## Programme Constraints

- Work from the isolated `codex/task-ledger-remediation` worktree and preserve the dirty shared checkout.
- Revalidate each row against current main and open pull requests immediately before editing its owner files.
- Do not duplicate or mutate active pull-request work. Adopt a landed implementation, defer a collision, or create a non-overlapping task.
- Serialize writes. One implementer owns one task at a time; a separate adversarial verifier reads the task brief, implementation report, and exact task diff.
- Use focused repository wrappers. Do not stack broad gates when a smaller check detects the changed failure class.
- Never weaken clinical, RAG, privacy, database, test, or CI contracts to obtain green output.
- Never fabricate clinician attestations, physical-device evidence, provider settings, production deployment, or elapsed-time observation.
- Database migrations, hosted configuration changes, live canaries, and remote policy mutations are separate acceptance events even when repository code is ready.
- Ledger requests are immutable inbox JSON produced by `npm run issues:done` or `npm run issues:update`; reconciliation remains a dedicated serialized operation.

## Autonomous Rulings

The user delegated the product and implementation decisions needed to execute the programme. The following conservative rulings apply unless current repository evidence makes them invalid:

- Keep intentionally shipped mockup assets, add `X-Robots-Tag: noindex, nofollow` to `/mockups/:path*`, and correct the crawler-policy README. Public retrievability and search indexing are distinct.
- Unsupported or explicitly unresolvable RAG answers refuse without claim-bearing citations or source cards. A citation must not make an unsupported answer appear supported.
- A guessed chunk identifier absent from already retrieved results does not trigger a secondary lookup.
- Document-match answers cite only documents that support an answer claim; inventories may still name uncited matches as inventory data when the UI labels them as such.
- Clinical pathway synthesis is not silently downgraded into a document-title list or extractive medication lookup.
- Add a database object-shape constraint for `documents.metadata`; the runtime Zod contract is not a substitute for storage integrity.
- Remove the redundant Therapy `home` generated asset because no runtime owner consumes it; retain the full and index generations.
- Therapy review tooling validates clinician-supplied decisions and attribution but never generates clinical sign-off.
- Physical Safari/PWA acceptance cannot be substituted by Chromium or Playwright WebKit emulation.
- Existing monitoring-only hazards remain in their safety documents after the operational ledger row closes.

## Current Classification

### Evidence-backed closure candidates

| IDs       | Basis                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#47M1XD` | Incident attribution was retracted by two production observation windows; unused-index cleanup is a separate decision.                                              |
| `#778Q0H` | The RSC boundary contract and original fix are already on current main.                                                                                             |
| `#GBBYTA` | The filtered-zero state is now a sibling of the results band, outside the result-card grid.                                                                         |
| `#0YK2S3` | The Caring Contacts focus timer is cleared on unmount and reset after firing.                                                                                       |
| `#XPY409` | The phone verification recipe already documents settled-height and stable-offset waits.                                                                             |
| `#NPQJKP` | The quality predicate, focused tests, accepted allowance, and live canary evidence are recorded on main; a separate answer defect must not be folded into this row. |
| `#1PN5BM` | The chosen confidence model, discriminating test, and hazard monitoring contract are already pinned; no measured signal calls for a code change.                    |

### Local implementation batches

| Batch                                | IDs                                                   |
| ------------------------------------ | ----------------------------------------------------- |
| Small reliability and contracts      | `#243HCC`, `#2TAQDC`, `#VV83VA`, `#4XBMMR`            |
| Tooling correctness                  | `#800E5M`, `#BJ80DB`, `#QSHHGK`                       |
| Worktree safety                      | `#XCAX01`, `#6GW95D`                                  |
| Browser coverage and diagnosis       | `#5DYBQQ`, `#71NT23`                                  |
| Documents and layout stability       | `#308`, `#321`, `#K9XD5N`, `#JVYQEM`, `#61TZJA`       |
| Mode-home consistency                | `#97VQK5`, `#V0EDR4`                                  |
| Therapy governance and consolidation | `#SBKXZ7`, `#2DQXD8`, `#NEBJAM`, `#V15EAS`, `#VTEW3W` |
| Docling fixtures                     | `#BSBE9B`                                             |
| Repository policy                    | `#8A00R7`, `#KZJD4Q`, `#JZM7RM`                       |
| Protected no-behaviour cleanup       | `#45V4Y7`                                             |
| Database contracts/tooling           | `#S19JRT`, `#8VAY97`                                  |
| Protected RAG behaviour              | `#C2D9JF`, `#NTAV3D`, `#VXB8XA`, `#S4R2W3`            |

### External or observation-gated rows

| IDs                                        | Remaining authoritative gate                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `#50QRCF`, `#KFRC3H`, `#TYZK23`            | Additional main-scoped hosted Lighthouse successes without recurrence.                                     |
| `#TF6TPJ`                                  | A live pull request proving main merges no longer produce the false-red cancellation symptom.              |
| `#72G3XZ`                                  | Dated GitHub Actions usage comparison after normal traffic.                                                |
| `#VKH7N1`                                  | A later canary with authoritative per-case latency showing no recurrence.                                  |
| `#164Z0H`, `#RZQQBT`                       | Real web/container lifecycle evidence for SessionStart and PreCompact hooks.                               |
| `#6SMMB4`                                  | Elevated Windows `fsutil` trust inspection; no trust-setting mutation.                                     |
| `#S4K1GA`                                  | Physical iPhone Safari and installed-PWA evidence for Motion Full and System.                              |
| `#HVTYAT`                                  | Exact production OpenAI project/account ZDR evidence.                                                      |
| `#9X40BT`                                  | Owner policy decision backed by current Supabase preview-compute controls and spend evidence.              |
| `#1VFSYF`                                  | First authorized shadow-mode observation with real timeout/memory data.                                    |
| `#2AB2NJ`                                  | A named dashboard consumer for verification latency.                                                       |
| `#JZM7RM`                                  | Authoritative identification and configuration of the app-level review watcher.                            |
| `#61TZJA`                                  | Authoritative Linux visual artifact after the DocumentViewer fix.                                          |
| `#8VAY97`, `#S19JRT`                       | Production database window, post-deploy drift check, and live EXPLAIN where applicable.                    |
| `#C2D9JF`, `#NTAV3D`, `#VXB8XA`, `#S4R2W3` | Focused offline proof followed by exactly one approved baseline/post live canary pair per behavior change. |

## Dependency Order

1. Queue only high-confidence stale-row closures.
2. Land deterministic non-overlapping contracts and documentation.
3. Harden tooling before using it for cleanup, generation, or hosted evidence.
4. Establish browser projects before relying on browser/phone acceptance.
5. Fix layout and shared UI owners before route-specific visual adoption.
6. Add Therapy governance before deleting or consolidating Therapy presentation owners.
7. Keep repository-policy, protected RAG, and database changes in dedicated commits and acceptance packets.
8. Perform external/provider/device observations last, using already-landed code and exact current targets.
9. Re-run the canonical report and queue final ledger mutations only from evidence generated by this programme.

## Verification Strategy

- Documentation/metadata: focused docs/static contract.
- Local component behavior: the single owning DOM/unit test.
- Browser behavior: `npm run ensure`, then the one repository-wrapped journey.
- Shared browser configuration: its configuration contract plus `verify:phone-chrome -- --dry-run` before any journey.
- Therapy generator/governance: focused unit tests and `check:therapy-data-index`.
- Docling fixtures: generator and `check:docling-lab`; extractor diff must remain empty.
- Cleanup tooling: synthetic directories only; never delete a live worktree as a test.
- Database: migration/schema/replay contracts locally; live state remains unclaimed until deployed and re-read.
- RAG: focused unit/harness, offline evaluator, adversarial offline evaluator, then one live canary pair.

## Completion Record

The implementation plan records each task's exact base and head, changed files, focused checks, external gates, and ledger request IDs. The programme is complete only when every supplied ID is either closed or carries a truthful durable blocker/trigger that cannot be completed from this environment.
