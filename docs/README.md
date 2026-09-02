# PsychSift Documentation Index

Categorised map of every tracked Markdown document under `docs/`: the load-bearing docs lead
each category, and an "Also catalogued" list completes it (the immutable
`branch-review-records/` and `outstanding-issues-inbox/` files are indexed by their own
generators, not here). Categories distinguish **maintained** documents (keep these current when
behavior changes) from **point-in-time records** (historical; do not update, supersede with a
new dated doc instead). `npm run check:repo-awareness-snapshot` reports any document this index
does not list.

Check that repo paths referenced from the maintained docs still resolve with:

```bash
npm run docs:check-links
```

## Start here

| Doc                                    | What it is                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [codebase-index.md](codebase-index.md) | Structured architecture map: layout, module map, Supabase schema, scripts, domain concepts                 |
| [README.md](README.md)                 | This index — every tracked document under `docs/`, categorised                                             |
| [site-map.md](site-map.md)             | **Generated** route map — regenerate with `npm run docs:update`, verify with `npm run sitemap:check`       |
| [agents-guide.md](agents-guide.md)     | Human onboarding pointer; Cursor MCP default read path (Supabase, Railway, Context7); rules in `AGENTS.md` |
| [scripts-index.md](scripts-index.md)   | Curated map of `scripts/` and the `package.json` command surface by purpose                                |
| [codex-cloud.md](codex-cloud.md)       | Codex Cloud setup, access profiles, profile-loading command shims, GitHub exception, and acceptance checks |
| [claude-cloud.md](claude-cloud.md)     | Claude Code on the web: the tiered container provisioner and the checked-in user profile                   |

## Architecture

- [frontend-architecture.md](frontend-architecture.md) — shell, routing, dashboard module structure
- [wiring-conventions.md](wiring-conventions.md) — page/button wiring conventions and the dead-button / orphan-route gates
- [search-chrome-behaviour.md](search-chrome-behaviour.md) — shared search-chrome contract: composer ownership, phone edge-to-edge dock, hide/reveal reserves
- [mockup-retirement-policy.md](mockup-retirement-policy.md) — when a mockup may be deleted, who decides, what evidence is required, and the three tiers that keep developer-gated prototypes out of cleanup scope
- [search-results-bar-decisions.md](search-results-bar-decisions.md) — shared results-bar anatomy, why the filter shelf is scoped to two modes, and what is deliberately not done
- [deployment-architecture.md](deployment-architecture.md) — app/worker/Supabase deployment topology
- [ingestion-state-machine.md](ingestion-state-machine.md) — ingestion job lifecycle and states (dated 2026-07-07 race analysis; the lease is heartbeated and fenced since 2026-07-08 — see its status banner)
- [design-system/README.md](design-system/README.md) — front door for the v2 design system (tokens, components, gates)
- [design-system.md](design-system.md) — live-layer notes during the v1→v2 transition (superseded as spec)
- [design-system/SPEC.md](design-system/SPEC.md) — the complete v2 design system: roles, rules, rationale (never values)
- [design-system/TOKENS.md](design-system/TOKENS.md) — reconciled token inventory: every role, winning name, owner, and what it replaces
- [design-system/COMPONENTS.md](design-system/COMPONENTS.md) — the eight safety-component specifications plus the maturity matrix
- [brand/psychsift-logo.md](brand/psychsift-logo.md) — the PsychSift mark: arc-by-arc construction, colours, file set, and usage rules
- [design-system/DECISIONS.md](design-system/DECISIONS.md) — conflicts C1–C5 resolved, clinical Q&A record, assumptions, blocked items
- [design-system/GATES.md](design-system/GATES.md) — every design-system rule paired with its enforcement status
- [design-system/FIX-GUIDE.md](design-system/FIX-GUIDE.md) — Hazard 1–2 sweep dispositions (Fixed / Documented / Deferred / Out-of-scope)
- [design-system/ADOPTION.md](design-system/ADOPTION.md) — PR 13 registration record: adoption order, per-surface file allowlists, exclusions, pins, proof shots
- [design-system/FIX-GUIDE.md](design-system/FIX-GUIDE.md) — Hazard 1–2 sweep dispositions (Fixed / Documented / Deferred / Out-of-scope)
- [comparison-behaviour.md](comparison-behaviour.md) — shared selection, state, responsive, and accessibility contract for comparison surfaces
- [clinical-chat-ui-component-map.md](clinical-chat-ui-component-map.md) — chat UI component inventory
- [clinical-badge-system-guide.md](clinical-badge-system-guide.md) — clinical badge semantics
- [multi-user-auth-setup.md](multi-user-auth-setup.md) — auth, sessions, owner scoping
- [pwa.md](pwa.md) — PWA install assets, privacy-first service worker, offline shell
- [webhooks.md](webhooks.md) — the two inbound webhook receivers and the outbound Actions notifier
- [api-jobs-ops-surface.md](api-jobs-ops-surface.md) — standing decision to keep `GET /api/jobs` as an ops/admin surface
- [verified-answer-incremental-delivery-design.md](verified-answer-incremental-delivery-design.md) — staged, clinical-safety-preserving design for delivering verified evidence and answer sections before the canonical final SSE frame

### Also catalogued (2026-09-02)

Every remaining tracked document in this category (architecture and design, plus the `design-system/`, `redesign/`, `adr/`, `decisions/` and `product/` folders), one line each; the description is the document's own title, with its opening sentence where that adds something.

- [app-modes-decision-brief.md](app-modes-decision-brief.md) — Fifteen modes, or one search with fifteen lenses? — A decision brief for the owner.
- [design-system-contract.md](design-system-contract.md) — Design System Contract & Standards — This document specifies the blocking design system token rules, touch/tap target standards, and enforcement mechanisms for the PsychSift app…
- [filter-contract.md](filter-contract.md) — The filter contract — One filter surface, shared by every mode.
- [design-system/HANDOVER-2026-08-07.md](design-system/HANDOVER-2026-08-07.md) — Design system — handover, 7 August 2026 — Read AGENTS.md first — it is the highest-priority source of truth for rules and gates.
- [design-system/sweep-2026-08-29-structure.md](design-system/sweep-2026-08-29-structure.md) — Structural sweep — 2026-08-29 — Read-only audit for defects the enforced lint/test gates cannot see:
- [design-system/sweep-2026-08-29-unenforced-rules.md](design-system/sweep-2026-08-29-unenforced-rules.md) — Unenforced-rule sweep — 29 August 2026 — Scope. The rules in this document set whose enforcement status is _absent, manual, partial, advisory or deferred_, checked against the actua…
- [design-system/sweep-2026-08-29-visual.md](design-system/sweep-2026-08-29-visual.md) — Visual sweep — 2026-08-29 — Read-only visual/DOM audit of the running dev app at http://localhost:3350.
- [design-system/sweep-fix-duration-display.md](design-system/sweep-fix-duration-display.md) — Design sweep fix: readable durations on the Team screen — Date: 2026-08-29 File touched:
- [design-system/sweep-fix-missing-values-round-2.md](design-system/sweep-fix-missing-values-round-2.md) — Missing values, round 2 — two new phrases (29 Aug 2026) — Round 1 (sweep-fix-missing-values.md) changed four call sites and left nineteen alone.
- [design-system/sweep-fix-missing-values.md](design-system/sweep-fix-missing-values.md) — Missing values — call-site sweep (29 Aug 2026) — SPEC §11 gives four phrases for a missing value — Not recorded, Not applicable, Unknown, Unable to extract — and names MissingValue (COMPONE…
- [design-system/sweep-fix-tap-floors-round-2.md](design-system/sweep-fix-tap-floors-round-2.md) — Sweep fix — tap floors, round 2 (2026-08-29) — Round 1 (sweep-fix-tap-floors.md) taught interactiveTapFloorDeclarations to read responsive bands.
- [design-system/sweep-fix-tap-floors.md](design-system/sweep-fix-tap-floors.md) — Responsive tap-floor sweep: closing a check that could not fail — Date: 2026-08-29 · Scope:
- [redesign/01-audit.md](redesign/01-audit.md) — Design Audit (June 2026 redesign) — This run intentionally excludes /tools, src/app/tools/page.tsx, and src/lib/tools.ts by user request.
- [redesign/02-design-direction.md](redesign/02-design-direction.md) — Design Direction — This supersedes the earlier "single teal accent for primary actions" principle.
- [redesign/03-decision-log.md](redesign/03-decision-log.md) — Decision Log — Tier 2 changes — Entries are appended as work lands.
- [redesign/04-deferred.md](redesign/04-deferred.md) — Resolved Deferred Items — Status: closed (reconciled 2026-07-15).
- [redesign/05-changelog.md](redesign/05-changelog.md) — Changelog — Premium Redesign
- [redesign/06-verification.md](redesign/06-verification.md) — Verification Report — Scope: ultra-premium mobile-first redesign — token system, component layer, dashboard + document-viewer mobile surfaces, plus reconciliation…
- [redesign/07-token-adoption-audit.md](redesign/07-token-adoption-audit.md) — Token Adoption Audit (July 2026) — This run audits how consistently the codebase consumes the design tokens, not the token system itself.
- [redesign/08-design-review-prompt.md](redesign/08-design-review-prompt.md) — Design Review Prompt (July 2026) — Two reusable prompts for reviewing design work on this product, tuned to its context:
- [redesign/09-page-polish-plan.md](redesign/09-page-polish-plan.md) — Production-Page Polish & Perfection Plan (July 2026) — Status: closed as superseded (reconciled 2026-07-15).
- [redesign/09-ui-primitives-recipes.md](redesign/09-ui-primitives-recipes.md) — UI Primitives — Recipe Reference & State Contract (July 2026) — Resolves L8 from 07-token-adoption-audit.md:
- [redesign/clinical-white-aegean-master-implementation-plan.md](redesign/clinical-white-aegean-master-implementation-plan.md) — Clinical White / Aegean Graphite Master Implementation Plan — The permanent direction should be Clinical White / Aegean Graphite.
- [redesign/crisp-white-colour-system-plan.md](redesign/crisp-white-colour-system-plan.md) — Crisp white colour system plan — Replace the warm cream/porcelain light-mode direction with a cleaner, whiter, more polished clinical interface.
- [redesign/dictionary-reference-spine.md](redesign/dictionary-reference-spine.md) — Dictionary Reference Spine — Dictionary is a source-governed psychiatric terminology reference.
- [redesign/m2-atomic-reindex-migration-note.md](redesign/m2-atomic-reindex-migration-note.md) — M2 Atomic Reindex Migration Note — Make reindex completion atomic so search, evaluation, telemetry, and document views never observe a partially replaced index generation.
- [redesign/permanent-colour-direction.md](redesign/permanent-colour-direction.md) — Permanent colour direction — Adopt Clinical White / Sky Graphite as the permanent colour direction.
- [redesign/premium-colour-system-plan.md](redesign/premium-colour-system-plan.md) — Premium colour system plan — Create a light mode that feels modern, premium, calm, and clinically trustworthy without becoming sterile, washed out, or over-teal.
- [adr/0001-use-a-shared-local-first-clinical-ask-orchestrator.md](adr/0001-use-a-shared-local-first-clinical-ask-orchestrator.md) — Use a shared local-first orchestrator for Mode-aware Clinical Ask — Mode-aware Clinical Ask will extend the repository's one shared composer and governed answer surfaces through one local-first orchestration…
- [decisions/ccz4hb-review-coverage.md](decisions/ccz4hb-review-coverage.md) — Decision: restoring automated review coverage (#CCZ4HB) — the row closed — but see the 2026-09-02 correction below, which removes the premise that decision rested on.
- [product/clinical-trust-direction.md](product/clinical-trust-direction.md) — Clinical trust product direction — Decision date: 2026-08-23 Decision:

## Operations runbooks

- [launch-operator-runbook.md](launch-operator-runbook.md) — launch/operational duties and SLO probes
- [reindex-runbook.md](reindex-runbook.md) — safe reindex and ingestion recovery
- [retrieval-quality-runbook.md](retrieval-quality-runbook.md) — RAG/retrieval eval gates and tuning
- [worker-deploy-runbook.md](worker-deploy-runbook.md) — worker build contract, run recipe, secrets, docling shadow extraction (B4)
- [disaster-recovery-runbook.md](disaster-recovery-runbook.md) — backup/restore and recovery drills
- [auth-connection-cap-runbook.md](auth-connection-cap-runbook.md) — Supabase auth connection cap (operator)
- [staging-setup.md](staging-setup.md) — staging environment bootstrap
- [database-drift-detection.md](database-drift-detection.md) — schema drift detection (`npm run check:drift`)
- [supabase-migration-reconciliation.md](supabase-migration-reconciliation.md) — migration drift and repair policy
- [db-maintenance.md](db-maintenance.md) — Supabase advisor snapshots and the standing disposition per finding class
- [observability-slos.md](observability-slos.md) — health probes, SLO counters, degraded modes
- [openai-rag-operations.md](openai-rag-operations.md) — OpenAI/RAG provider operations and modes
- [outstanding-issues.md](outstanding-issues.md) — single universal task ledger and repository memory
- [operator-backlog.md](operator-backlog.md) — provider/operator runbook detail (status is canonical in the universal ledger)
- [deploy-corrector-public-titles.md](deploy-corrector-public-titles.md) — public-title corrector deploy notes
- [operator-apply-performance-latency-remediation.md](operator-apply-performance-latency-remediation.md) — operator apply steps for the performance/latency migration batch
- [reconciliation-playbook.md](reconciliation-playbook.md) — broad chat/worktree reconciliation and archive-safe cleanup (not for ordinary feature work)
- [staging-tenancy-release-evidence.md](staging-tenancy-release-evidence.md) — cross-tenant staging harness as executable owner-boundary proof

### Also catalogued (2026-09-02)

Every remaining tracked document in this category (operations, plus the `rag-behaviour/` and `rag-improvement/` folders), one line each; the description is the document's own title, with its opening sentence where that adds something.

- [database-remediation-plan.md](database-remediation-plan.md) — Database remediation & future-proofing plan — 2026-08 — Owner: operator (Josh) + specialist session.
- [database-remediation-playbook.md](database-remediation-playbook.md) — Database remediation playbook — multi-session execution guide — Companion to database-remediation-plan.md (the plan of record — read it first in every session).
- [database-remediation-coordination.md](database-remediation-coordination.md) — Database remediation — coordination handover
- [operations-runbook.md](operations-runbook.md) — Operations Runbook: Database Index Diagnostics & Pre/Post EXPLAIN Measurement Protocol — This runbook defines the operational verification and execution protocol for measuring query planner performance and diagnosing documents ta…
- [operator-supabase-branching-cap.md](operator-supabase-branching-cap.md) — Operator guidance: Supabase preview-branch compute cap (#9X40BT) — This document records the operator configuration and cost-containment policy for Supabase preview branches on project sjrfecxgysukkwxsowpy (…
- [performance.md](performance.md) — Performance and Web Vitals Baselines — This document outlines performance benchmarks, layout stability strategies, and Core Web Vitals baselines for the PsychSift application.
- [rag-evaluation.md](rag-evaluation.md) — RAG Evaluation and Retrieval Contracts — This document specifies the RAG evaluation framework, runtime retrieval row contracts, and defensive schema invariants that protect clinical…
- [rag-behaviour/README.md](rag-behaviour/README.md) — RAG behaviour memory — Durable, evidence-backed knowledge about how this repo's retrieval/ranking stack actually behaves — created 2026-07-20 after a full measure…
- [rag-behaviour/behaviour-map.md](rag-behaviour/behaviour-map.md) — RAG behaviour map (verified 2026-07-20) — Everything below was verified against live canary evidence (runs #49–#56) and direct source inspection during the ADDENDUM-4 cycle.
- [rag-behaviour/refuted-approaches.md](rag-behaviour/refuted-approaches.md) — Refuted ranking-improvement approaches (2026-07-20) — Two approaches to the fast-path rank-depth headroom were implemented, live-tested, and refuted in one evening.
- [rag-behaviour/safeguards.md](rag-behaviour/safeguards.md) — RAG ranking safeguards — The protection stack that keeps retrieval/ranking behaviour from being changed casually — by any task, session, or agent.
- [rag-improvement/gate-b-decision-record-2026-08-18.md](rag-improvement/gate-b-decision-record-2026-08-18.md) — Gate B decision record — Docling extraction benchmark (owner run, 2026-08-18) — Status: PASS. This is the owner's filled copy of docs/rag-improvement/gate-b-decision-record.md for packet S6b (the Gate B run the S6 harnes…
- [rag-improvement/gate-b-decision-record.md](rag-improvement/gate-b-decision-record.md) — Gate B decision record — Docling extraction benchmark (template) — Status: template — no verdict.

## Governance, safety, privacy

- [clinical-governance.md](clinical-governance.md) — deployment and source governance checklist
- [error-tracking.md](error-tracking.md) — privacy-safe, opt-in production exception tracking envelope
- [governance-incident-runbooks.md](governance-incident-runbooks.md) — operator response checklists for clinical, source, privacy, provider, and answer-pipeline rollback incidents
- [clinical-hazard-analysis.md](clinical-hazard-analysis.md) — clinical hazard register
- [rag-injection-threat-model.md](rag-injection-threat-model.md) — prompt-injection threat model
- [privacy-impact-assessment.md](privacy-impact-assessment.md) — PIA findings and launch blockers
- [openai-cross-border-basis.md](openai-cross-border-basis.md) — cross-border data-processing basis
- [governance/privacy-readiness.v1.json](governance/privacy-readiness.v1.json) — authoritative machine-checkable privacy readiness status
- [governance/privacy-closeout-2026-09-01.md](governance/privacy-closeout-2026-09-01.md) — current provider, retention, legal, notice, and clinical closeout evidence
- [governance/privacy-role-attestation-pack-2026-09-01.md](governance/privacy-role-attestation-pack-2026-09-01.md) — evidence and role decisions for eight requirements; two owner approvals are complete and six remain
- [production-readiness-checklist.md](production-readiness-checklist.md) — release readiness criteria
- [samd-classification-medication-considerations.md](samd-classification-medication-considerations.md) — SaMD classification and medication considerations

### Also catalogued (2026-09-02)

Every remaining tracked document in this category, one line each; the description is the document's own title, with its opening sentence where that adds something.

- [medication-interaction-lexicon-review.md](medication-interaction-lexicon-review.md) — Medication interaction lexicon — clinical review sheet — Status: reviewed 2026-08-22 — see the sign-off at the bottom.
- [medication-lexicon-review-worklist.md](medication-lexicon-review-worklist.md) — Medication lexicon — clinician reading worklist (#318) — This is a reading aid, not a review.
- [services-mode-governance.md](services-mode-governance.md) — Services Mode Governance — A Services record is not “current” merely because its prose is plausible or its confidence is high.

## Process and review

- [process-hardening.md](process-hardening.md) — verification gates, CI expectations, known debts
- [continuous-integration.md](continuous-integration.md) — workflow concurrency keys, push exemption, and Guard 2 in-flight CI push guard
- [testing.md](testing.md) — test execution, focused/live commands, Playwright ownership, flake policy
- [development-speed-playbook.md](development-speed-playbook.md) — going faster without weakening any gate: arbiter, receipts, narrow selection, worktree reuse
- [ward-flow-clinician-check.md](ward-flow-clinician-check.md) — one-page plain-English check of the four-stage bed model, for a ward clinician
- [ward-flow-phase-6-7-decisions.md](ward-flow-phase-6-7-decisions.md) — owner decisions settled before Phases 6 and 7 are designed
- [ward-flow-phase-6-7-kickoff-prompt.md](ward-flow-phase-6-7-kickoff-prompt.md) — paste-in prompt to open the Phase 6 and 7 design conversation
- [phone-chrome-physical-acceptance.md](phone-chrome-physical-acceptance.md) — labelled Safari and cold-launch PWA acceptance matrix
- [productivity-workflows.md](productivity-workflows.md) — repo workflow planners (flightplan, triage, rag-lab, …)
- [codex-review-protocol.md](codex-review-protocol.md) — shared review protocol for all review skills
- [codex-prompt-playbook.md](codex-prompt-playbook.md) — copy/paste prompts for common repo work
- [codex-cloud.md](codex-cloud.md) — reproducible provider-free Codex Cloud environment and acceptance check
- [claude-cloud.md](claude-cloud.md) — Claude Code on the web container parity: tiered provisioner and checked-in user profile
- [branch-cleanup-guide.md](branch-cleanup-guide.md) — branch hygiene workflow
- [branch-review-ledger.md](branch-review-ledger.md) — reviewed branch/SHA ledger; read with `npm run ledger:lookup` (historical tables + immutable records), write with `npm run ledger:append`, and convert a pre-system active-branch row with `npm run ledger:migrate-legacy`
- [branch-review-archival-policy.md](branch-review-archival-policy.md) — what may and may not be done to the immutable records under `docs/branch-review-records/`; which operations are blocked by code, which are forbidden by policy but caught by nothing, and why foldering or deleting a record is silent history loss
- [branch-review-index.md](branch-review-index.md) — **Generated** browsable index of every immutable review record; regenerate with `npm run ledger:index`, refresh with `npm run docs:update`, check currency with `npm run ledger:index:check`. It may lag the corpus, so `npm run ledger:lookup` stays authoritative

### Also catalogued (2026-09-02)

Every remaining tracked document in this category (process, plus the `agents/` rule files `AGENTS.md` delegates to, `prompts/`, `codex/` and `plans/`), one line each; the description is the document's own title, with its opening sentence where that adds something.

- [ci-operations.md](ci-operations.md) — CI Operations and Runner Usage Assessment — See also continuous-integration.md for pre-push safety controls and Guard 2 in-flight CI push guard details.
- [agents/bug-hunter-shortcut.md](agents/bug-hunter-shortcut.md) — Bug-Hunter Shortcut — When the user types exactly bug-hunter as the entire task message, after trimming surrounding whitespace, treat it as a shortcut for targete…
- [agents/claude-hook-scripts.md](agents/claude-hook-scripts.md) — Claude Code Hook Scripts — .claude/hooks/*.sh runs on Linux web containers as well as on the Windows workstation, and the workstation cannot see the thing that breaks…
- [agents/codex-cloud-environment.md](agents/codex-cloud-environment.md) — Codex Cloud Environment — Codex Cloud uses an isolated Linux container and does not inherit desktop files, credentials, OAuth sessions, MCP authentication, local serv…
- [agents/codex-dependency-shortcut.md](agents/codex-dependency-shortcut.md) — Codex Dependency Shortcut — When the user types exactly dependency as the entire task message, after trimming surrounding whitespace, treat it as a shortcut for safe de…
- [agents/codex-desktop-worktree-setup.md](agents/codex-desktop-worktree-setup.md) — Codex Desktop Worktree Setup — It must work before node_modules exists, validate Node 24/npm 11, reuse only a complete byte-identical local installation, and otherwise run…
- [agents/codex-github-review.md](agents/codex-github-review.md) — Codex GitHub Review Behavior & Auto-Fixer — These instructions apply to Codex GitHub pull request reviews and Codex tasks started from PR comments.
- [agents/codex-productivity-defaults.md](agents/codex-productivity-defaults.md) — Codex Productivity Defaults
- [agents/codex-reasoning-effort.md](agents/codex-reasoning-effort.md) — Codex Reasoning Effort Calibration
- [agents/codex-review-throttling.md](agents/codex-review-throttling.md) — Codex Review Throttling & Thread Resolution — Do not review branches opportunistically.
- [agents/cursor-cloud.md](agents/cursor-cloud.md) — Cursor Cloud Specific Instructions — Durable notes for Cloud Agents.
- [agents/dead-code-deletion.md](agents/dead-code-deletion.md) — Deleting Code You Believe Is Dead — "Nothing imports it" is necessary and nowhere near sufficient.
- [agents/external-skill-precedence.md](agents/external-skill-precedence.md) — External Skill Precedence and Evidence — User-global skills and output-style plugins are installed outside this repo and know nothing about its contracts.
- [agents/pull-request-workflow.md](agents/pull-request-workflow.md) — Pull Request Workflow — Open PR heads go stale whenever main advances.
- [agents/repository-skills-and-issues.md](agents/repository-skills-and-issues.md) — Repository Skills and Outstanding-Work Memory — Automatically apply repo-local skills under .agents/skills/ when their descriptions match the user's request.
- [agents/test-deletion-guard.md](agents/test-deletion-guard.md) — Deleting tests, or letting a tool delete them for you — On 2026-08-31 a commit on PR #2481 titled "test(ui):
- [agents/upload-shortcut.md](agents/upload-shortcut.md) — Upload Shortcut — When the user types exactly:
- [agents/verification-gates.md](agents/verification-gates.md) — Verification Gates and the Gate Arbiter — check:gate-manifest enforces a one-way invariant:
- [agents/wiring-and-bundle-budget.md](agents/wiring-and-bundle-budget.md) — Page Wiring and Bundle Budget — Interactive controls and routes follow conventions the codebase already holds to.
- [prompts/codex-architecture-maintainability-ultra-review.md](prompts/codex-architecture-maintainability-ultra-review.md) — Codex Local Ultra — Architecture & Maintainability Review Orchestrator — Perform a rigorous, evidence-based Architecture and Maintainability review of this repository using multi-agent coordination.
- [prompts/codex-cloud-design-status-semantics.md](prompts/codex-cloud-design-status-semantics.md) — Codex Cloud prompt — design-system clinical status semantics — Copy the complete prompt below into a new Codex Cloud task for the Database repository KB repository.
- [prompts/codex-cloud-detailed-task.md](prompts/codex-cloud-detailed-task.md) — Codex Cloud detailed-task prompt — Use this prompt when assigning a substantial implementation, refactor, defect fix, or other detailed task to Codex Cloud in this repository.
- [prompts/codex-cloud-review/1-codex-full-stack-master-review-prompt.md](prompts/codex-cloud-review/1-codex-full-stack-master-review-prompt.md) — Codex Comprehensive Full-Stack Product, Design, Architecture, Engineering, Security, Quality and Refactoring Master Prompt — Keep this master specification as a normal Markdown file, for example:
- [prompts/codex-cloud-review/2-codex-full-stack-master-prompt-review-and-stress-test.md](prompts/codex-cloud-review/2-codex-full-stack-master-prompt-review-and-stress-test.md) — Review and Adversarial Stress Test of the Codex Full-Stack Master Prompt — The original Cursor prompt had unusually strong domain coverage and quality controls.
- [prompts/codex-cloud-review/3-codex-agents-md-companion.md](prompts/codex-cloud-review/3-codex-agents-md-companion.md) — Codex Repository Working Agreement
- [prompts/codex-data-database-safety-ultra-review.md](prompts/codex-data-database-safety-ultra-review.md) — Codex Local Ultra — Data & Database Safety Review Orchestrator — Perform a rigorous, evidence-based Data & Database Safety review of this repository using multi-agent coordination.
- [prompts/codex-documentation-ownership-ultra-review.md](prompts/codex-documentation-ownership-ultra-review.md) — Codex Local Ultra — Documentation & Ownership Review Orchestrator — Perform a rigorous, evidence-based Documentation & Ownership review of this repository using multi-agent coordination.
- [prompts/codex-functional-correctness-ultra-review.md](prompts/codex-functional-correctness-ultra-review.md) — Codex Local Ultra — Functional Correctness Review Orchestrator — Perform a rigorous, evidence-based Functional Correctness review of this repository using multi-agent coordination.
- [prompts/codex-performance-reliability-ultra-review.md](prompts/codex-performance-reliability-ultra-review.md) — Codex Local Ultra — Performance & Reliability Review Orchestrator — Perform a rigorous, evidence-based Performance and Reliability review of this repository using multi-agent coordination.
- [prompts/codex-tests-quality-gates-ultra-review.md](prompts/codex-tests-quality-gates-ultra-review.md) — Codex Local Ultra — Tests & Quality Gates Review Orchestrator — Perform a rigorous, evidence-based Tests & Quality Gates review of this repository using multi-agent coordination.
- [prompts/mode-aware-clinical-ask-codex-cloud-handover.md](prompts/mode-aware-clinical-ask-codex-cloud-handover.md) — Codex Cloud handover: implement Mode-aware Clinical Ask — Paste the prompt below into a fresh Codex Cloud task whose checkout contains this entire planning pack.
- [prompts/rag-coverage-gate-extraction.md](prompts/rag-coverage-gate-extraction.md) — X3 / #086 rag.ts coverage-gate extraction — Use this prompt in a fresh Codex Cloud task with CODEX_CLOUD_ACCESS_PROFILE=offline.
- [codex/architecture-maintainability/README.md](codex/architecture-maintainability/README.md) — Architecture and maintainability review packets — Durable artifacts requested from the architecture and maintainability review prompt belong here.
- [codex/data-database-safety/README.md](codex/data-database-safety/README.md) — Data and database safety review packets — Durable artifacts requested from the data and database safety review prompt belong here.
- [codex/documentation-ownership/README.md](codex/documentation-ownership/README.md) — Documentation and ownership review packets — Durable artifacts requested from the documentation and ownership review prompt belong here.
- [codex/functional-correctness/README.md](codex/functional-correctness/README.md) — Functional correctness review packets — Durable artifacts requested from the functional correctness review prompt belong here.
- [codex/performance-reliability/README.md](codex/performance-reliability/README.md) — Performance and reliability review packets — Durable artifacts requested from the performance and reliability review prompt belong here.
- [codex/tests-quality-gates/README.md](codex/tests-quality-gates/README.md) — Tests and quality-gates review packets — Durable artifacts requested from the tests and quality-gates review prompt belong here.
- [plans/design-system-live-convergence-plan.md](plans/design-system-live-convergence-plan.md) — Design-system live convergence programme — Status: execution-ready plan…
- [plans/document-viewer-phase2-unified-chrome.md](plans/document-viewer-phase2-unified-chrome.md) — Phase 2 — Unified viewing chrome (PDF + photo) — Status: plan only (no product behaviour change in this doc PR) Programme:
- [plans/document-viewer-phase3-handover.md](plans/document-viewer-phase3-handover.md) — Document viewer — Phase 3 handover — Execution brief for Phase 3 of docs/plans/document-viewer-redesign-plan.md.
- [plans/document-viewer-redesign-plan.md](plans/document-viewer-redesign-plan.md) — Document viewer redesign — PDF + photo surfaces — Status: programme plan (Phases 0–3 landed;
- [plans/edge-ingestion-overhaul-3pr-plan.md](plans/edge-ingestion-overhaul-3pr-plan.md) — Edge Ingestion Overhaul — 3-PR Execution Plan — Status: Planning only.
- [plans/tooling-activation-implementation-plan.md](plans/tooling-activation-implementation-plan.md) — Tooling activation — implementation plan — Status: local workstreams (WS-B, WS-C) implemented 2026-08-01;

## Plans and workstreams (living)

- [mode-aware-clinical-ask-local-handover.md](mode-aware-clinical-ask-local-handover.md) — three-phase local integration, approval-gated staging/governance, and PR publication handover for Mode-aware Clinical Ask
- [answer-page-redesign-handover.md](answer-page-redesign-handover.md) — build-and-merge handover for the chosen answer-page design: what claim-level citation data already exists, the three-PR order it forces, the design contract, and the gates and PR-body requirements that block the merge
- [maturity-backlog-workorders.md](maturity-backlog-workorders.md) — actionable work orders tracking the repository-maturity audit backlog
- [no-unchecked-indexed-access-migration-plan.md](no-unchecked-indexed-access-migration-plan.md) — staged multi-PR rollout for the `noUncheckedIndexedAccess` TypeScript flag (ledger `#211`)
- [ledger-id-scheme-proposal.md](ledger-id-scheme-proposal.md) — design for collision-free outstanding-issue ids so concurrent sessions stop contending on `issues:next-id` (ledger `#168`)
- [pr-handoff-stop-cross-agent-gap.md](pr-handoff-stop-cross-agent-gap.md) — why the PR-babysit budget is hook-enforced for Claude Code but prose-only for Codex and Cursor, and what parity would require (ledger `#258`)
- [framework-dependency-modernization-checklist.md](framework-dependency-modernization-checklist.md) — ordered Next.js 16, runtime, dependency, Turbopack, and verification migration program
- [search-rag-master-plan.md](search-rag-master-plan.md) / [search-rag-master-context.md](search-rag-master-context.md) — search/RAG roadmap and shared context
- [rag-improvement/README.md](rag-improvement/README.md) — reviewed/updated RAG improvement programme: answer-quality track (intent-aware related information, length) + corrected eval/safety infra track
- [rag-improvement/HANDOVER.md](rag-improvement/HANDOVER.md) — multi-session handover: per-session work packets, status table, checklists, and paste-ready prompts for executing the programme
- [rag-improvement/COORDINATION.md](rag-improvement/COORDINATION.md) — coordinator handover: programme history, wave/session decisions, babysit playbook, approvals map, and the coordination-chat bootstrap prompt
- [rag-improvement/231-diagnosis-2026-08-22.md](rag-improvement/231-diagnosis-2026-08-22.md) — `#231` evidence record: the row's timeout premise measured against the 60 Gate E answers, the three populations behind `source_only`, and the grounded-extractive gate gap
- [rag-improvement/baseline-record.md](rag-improvement/baseline-record.md) — programme evaluation baseline: the six-field report key, gate results, and which gates stay pending an owner-approved provider run
- [rag-improvement/data-flow-register.md](rag-improvement/data-flow-register.md) — Gate A register: every RAG input, process, sink, retention window, provider egress, and the known gaps
- [rag-hybrid-findings-and-todo.md](rag-hybrid-findings-and-todo.md) — hybrid retrieval findings backlog
- [reindex-shadow-harness-design.md](reindex-shadow-harness-design.md) — designed-only shadow reindex harness (driver not built)
- [ingestion-concurrency-fix-workorder.md](ingestion-concurrency-fix-workorder.md) — ingestion concurrency workorder
- [redesign/](redesign/) — premium redesign plans, decision log, token adoption
- [superpowers/](superpowers/) — agent-authored plans and specs
- **Care Plan (prototype, developer-gated under `/mockups/care-plan`)** — [superpowers/specs/2026-08-20-care-plan-design.md](superpowers/specs/2026-08-20-care-plan-design.md) is the binding design spec, [care-plan-context.md](care-plan-context.md) the binding glossary, [superpowers/plans/2026-08-20-care-plan-implementation.md](superpowers/plans/2026-08-20-care-plan-implementation.md) the implementation plan, [care-plan/sdd-ledger.md](care-plan/sdd-ledger.md) the build ledger and [care-plan/complete-work-ledger.md](care-plan/complete-work-ledger.md) the record of what landed; the dated handoffs, transcripts and reports under [care-plan/](care-plan/) are point-in-time records

### Also catalogued (2026-09-02)

Every remaining tracked document in this category (the Ward Flow developer-gated prototype's context, decisions, roadmap, ledgers and dated handovers), one line each; the description is the document's own title, with its opening sentence where that adds something.

- [corpus-health-panel-handover.md](corpus-health-panel-handover.md) — Corpus health panel — handover — Status: both changes are merged to main.
- [ward-flow-complete-ledger.md](ward-flow-complete-ledger.md) — Ward Flow — the complete ledger, Phases 1 to 5 — The single cross-session record of everything built.
- [ward-flow-context.md](ward-flow-context.md) — Ward Flow — complete context — Everything a session needs to work on Ward Flow, in one file.
- [ward-flow-phase-2-kickoff.md](ward-flow-phase-2-kickoff.md) — Ward Flow Phase 2 — kickoff brief for a fresh session — Paste the block at the bottom of this file into a new chat.
- [ward-flow-phase-3-handover.md](ward-flow-phase-3-handover.md) — Ward Flow Phase 3 — session handover — Rewritten 2026-08-23, at the end of session 3.
- [ward-flow-phase-3-ledger.md](ward-flow-phase-3-ledger.md) — ward-flow-phase-3-ledger
- [ward-flow-phase-3-rulings.md](ward-flow-phase-3-rulings.md) — Ward Flow Phase 3 — every decision made on the product owner's behalf — 73 rulings, made across three sessions while executing the 12-task plan.
- [ward-flow-phase-5-handover.md](ward-flow-phase-5-handover.md) — Ward Flow Phase 5 — session handover — Written 2026-08-26, before the merge;
- [ward-flow-phase-5-kickoff-prompt.md](ward-flow-phase-5-kickoff-prompt.md) — Ward Flow Phase 5 — kickoff prompt — Paste the block below into a fresh session as its first message.
- [ward-flow-phase-handoff.md](ward-flow-phase-handoff.md) — Ward Flow — phase handoff — Durable record of decisions taken while executing the Ward Flow phase plans.
- [ward-flow-pinned-clock-handover.md](ward-flow-pinned-clock-handover.md) — Ward Flow — the pinned-clock defect: session handover — Why this file exists.
- [ward-flow-roadmap.md](ward-flow-roadmap.md) — Ward Flow roadmap and settled decisions — What this file is for.
- [ward-management-context.md](ward-management-context.md) — Ward Flow — domain glossary — The ubiquitous language for the ward-management context.
- [ward-management-decisions.md](ward-management-decisions.md) — Ward Flow — architecture decisions — Decisions for the ward-management context that are hard to reverse, surprising without context, and the result of a real trade-off.
- [ward-management-mode-map.md](ward-management-mode-map.md) — Ward Flow mode map — Superseded: the nine-mode strip this document describes is superseded by the role-first structure (flow coordinator, ED, ward, transport off…

## Subdirectory map

| Directory                                        | What lives there                                                                                                                                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [agents/](agents/)                               | Agent-rule reference files `AGENTS.md` delegates to by name — the full text of rules its always-loaded core only points at                                                                               |
| [rag-behaviour/](rag-behaviour/)                 | Protected retrieval/ranking surface: behaviour map, refuted approaches, safeguards. **Read before touching ranking.**                                                                                    |
| [prompts/](prompts/)                             | Copy/paste review prompts, including the verbatim `codex-cloud-review/` inputs                                                                                                                           |
| [codex/](codex/)                                 | Per-lens Codex ultra-review output folders, one per review dimension                                                                                                                                     |
| [evidence/](evidence/)                           | Captured evidence artifacts backing ledger items (reliability reports, review manifests)                                                                                                                 |
| [audit/](audit/)                                 | Dated repo, design, accessibility, and latency audits (point-in-time)                                                                                                                                    |
| [redesign/](redesign/)                           | Premium redesign plans, decision log, token adoption                                                                                                                                                     |
| [superpowers/](superpowers/)                     | Agent-authored plans and specs                                                                                                                                                                           |
| [branch-review-records/](branch-review-records/) | Immutable one-row review records — one file per review — named for the SHA-256 of the row. **Append-only: never edit, delete, or move into subdirectories** ([policy](branch-review-archival-policy.md)) |
| [archive/](archive/)                             | Completed phase plans, superseded designs, old progress logs — never current guidance                                                                                                                    |

## Point-in-time records (historical — do not update)

Dated status reports, reviews, and operator decisions. They describe the repo
as it was on that date; supersede with a new dated document rather than editing.

- [audit/](audit/) — repo and UX/accessibility audits
- [audit/full-repository-audit-2026-09-02.md](audit/full-repository-audit-2026-09-02.md) — full repository audit (25 lanes, independently verified findings, closed-off sub-projects, machine evidence, Stage-5 adversarial review; audit only, nothing acted on except one-line documentation corrections)
- [audit/2026-07-20-repository-maturity.md](audit/2026-07-20-repository-maturity.md) — full repository maturity, mapping, and organisation audit
- [audit/latency-audit-2026-07-28.md](audit/latency-audit-2026-07-28.md) — latency audit: server, client, and database findings by tier, with the already-cleared list
- [audit/audit-handover-2026-07-14.md](audit/audit-handover-2026-07-14.md) — multi-skill repository audit findings inventory
- [audit/audit-remediation-plan-2026-07-14.md](audit/audit-remediation-plan-2026-07-14.md) — sequenced remediation plan for the 2026-07-14 audit, with the 2026-07-17 reconciliation
- [audit/design-audit-2026-07-17.md](audit/design-audit-2026-07-17.md) — repository-wide design, accessibility, and interaction audit
- [audit/cloud-connection-acceptance-2026-08-05.md](audit/cloud-connection-acceptance-2026-08-05.md) — hosted versus local MCP boundary acceptance, Personal Pro split control plane, and remaining Cloud launcher blockers
- [audit/claude-code-cloud-connection-acceptance-2026-08-17.md](audit/claude-code-cloud-connection-acceptance-2026-08-17.md) — Claude Code desktop-vs-cloud connector parity check (Railway/Figma/Sentry/Supabase/GitHub live-verified), dependency-currency hook, open Supabase-scope and GitHub-portability items
- [current-clinical-work-brief.md](current-clinical-work-brief.md) — ledger #063 product/privacy/persistence brief (decision only, no implementation)
- [factsheets-reading-model-brief.md](factsheets-reading-model-brief.md) — ledger #041 reading-model decision (no second Factsheets mode)
- [tooling-follow-through-decisions-2026-08-12.md](tooling-follow-through-decisions-2026-08-12.md) — ledger #150 CodeRabbit cap policy and #151 GitHub Actions observation fallback
- [source-governance-refresh-worklist-2026-07-22.md](source-governance-refresh-worklist-2026-07-22.md) — ledger #022 worklist and BMJ attestation policy status
- `release-source-metadata-debt-2026-06-30.json` — captured source-metadata debt policy, consumed by `npm run audit:source-governance:release` and `npm run eval:quality:release`
- [forward-codify-retrieval-rpcs-workorder.md](forward-codify-retrieval-rpcs-workorder.md) — completed retrieval RPC codification workorder
- [project-alignment-cleanup.md](archive/project-alignment-cleanup.md) — completed June 2026 repo-alignment record
- [capacity-review.md](audit/capacity-review.md), [scale-readiness-review.md](audit/scale-readiness-review.md), [tenancy-defense-in-depth-review.md](audit/tenancy-defense-in-depth-review.md)
- `*-2026-*` findings and status docs, e.g. [chunking-ocr-reindex-lever-finding-2026-07-08.md](chunking-ocr-reindex-lever-finding-2026-07-08.md), [source-governance-status-2026-07-08.md](archive/source-governance-status-2026-07-08.md), [source-governance-priorities-2026-07-02.md](archive/source-governance-priorities-2026-07-02.md), [source-review-priority-2026-07-02.md](source-review-priority-2026-07-02.md), [operator-apply-july8-batch.md](archive/operator-apply-july8-batch.md)

### Also catalogued (2026-09-02)

Every remaining tracked document in this category (dated records and the `evidence/`, `archive/`, `audit/`, `care-plan/`, `caring-contacts/`, `superpowers/` and `ward-flow-phase-3-workspace/` folders — historical; do not update), one line each; the description is the document's own title, with its opening sentence where that adds something.

- [review-findings-2026-08-02.md](review-findings-2026-08-02.md) — Mega-review report — TypeScript, code, quality, explicit-any, unchecked indexed access — Date: 2026-08-02 Scope:
- [evidence/bundle-budget-production-rebaseline-2026-08-18.md](evidence/bundle-budget-production-rebaseline-2026-08-18.md) — Production bundle-budget re-baseline — 2026-08-18 — check:bundle-budget compares the client JavaScript a non-mockup route can reach against a baseline captured from a known-good build.
- [evidence/mha-2014-section-summaries-review.md](evidence/mha-2014-section-summaries-review.md) — Mental Health Act 2014 (WA) — section summary review sheet — Act version 02-b0-01, as at 2025-09-25.
- [evidence/mobile-root-timing-control-2026-08-26.md](evidence/mobile-root-timing-control-2026-08-26.md) — Mobile-root timing control — 2026-08-26 — The mobile-root timing signal recorded during PR #2313 was not reproduced on pinned Linux CI.
- [evidence/performance-remediation-2026-08-23.md](evidence/performance-remediation-2026-08-23.md) — Current-main performance remediation evidence — 2026-08-23 — This change fixes the two deterministically attributed layout mechanisms on the shared search shell, removes an unsolicited Applications-rou…
- [evidence/rag-irrelevant-at-10-disposition.md](evidence/rag-irrelevant-at-10-disposition.md) — RAG irrelevant-at-10 labeling disposition & browser matrix evidence — 2026-08-27 — This document records the human review disposition and scheduled browser matrix verification for ledger issue #023 (P2), completing the eval…
- [evidence/rag-reliability-evidence-2026-07-27.md](evidence/rag-reliability-evidence-2026-07-27.md) — RAG reliability evidence — 2026-07-27 — This record captures the final local/live evidence for the 2026-07-27 RAG reliability work.
- [archive/BRANCH_ARCHIVE_20260709.md](archive/BRANCH_ARCHIVE_20260709.md) — Obsolete Branch Archive — This branch preserves the histories of obsolete remote branches before deleting their scattered refs.
- [archive/COLOR_REDESIGN_PLAN.md](archive/COLOR_REDESIGN_PLAN.md) — Luxury Black-First Color Redesign Plan (Global UI Polish) — Apply a refined, premium dark-first visual system across the app with minimal risk:
- [archive/TOOLS_CONTEXT_FOR_NEW_CHAT.md](archive/TOOLS_CONTEXT_FOR_NEW_CHAT.md) — Context handoff: Tools / Applications UX task — I’m creating this file so a new chat can continue the exact task with full context, including screenshots referenced so far.
- [archive/branch-cleanup-2026-06-28.md](archive/branch-cleanup-2026-06-28.md) — Branch Cleanup Snapshot — 2026-06-28 — Archived from docs/branch-cleanup-guide.md on 2026-07-04.
- [archive/branch-progress-2026-07-05.md](archive/branch-progress-2026-07-05.md) — Branch Progress Snapshot — 2026-07-05 — Archived from the working tree on 2026-07-05.
- [archive/branch-review-ledger-2026-q3.md](archive/branch-review-ledger-2026-q3.md) — Branch Review Ledger Archive — 2026-q3 — Historical review records rotated out of docs/branch-review-ledger.md so the live table stays navigable.
- [archive/clinical-chat-ui-implementation-plan.md](archive/clinical-chat-ui-implementation-plan.md) — Clinical Chat UI Implementation Plan — Date: 2026-06-23…
- [archive/clinical-chat-ui-phase-checklist.md](archive/clinical-chat-ui-phase-checklist.md) — Clinical Chat UI Phase Checklist — Date: 2026-06-23…
- [archive/cloud-chat-reconciliation-2026-07-22.md](archive/cloud-chat-reconciliation-2026-07-22.md) — Cloud-chat reconciliation record — 2026-07-22 — This record closes the Database cloud-chat reconciliation against protected origin/main.
- [archive/cloud-chat-reconciliation-postmortem-2026-07-23.md](archive/cloud-chat-reconciliation-postmortem-2026-07-23.md) — Cloud-chat reconciliation postmortem — 2026-07-23 — This is the durable final account of the Database cloud-chat reconciliation.
- [archive/design-qa-2026-07-15.md](archive/design-qa-2026-07-15.md) — Design QA — 2026-07-15 — Final result: blocked.
- [archive/design-qa.md](archive/design-qa.md) — design-qa
- [archive/operator-decisions-2026-07-04.md](archive/operator-decisions-2026-07-04.md) — Operator decisions — 2026-07-04 — Historical snapshot of manual follow-ups deferred during documentation and verification gate recovery work.
- [archive/operator-decisions-2026-07-06.md](archive/operator-decisions-2026-07-06.md) — Operator decisions — 2026-07-06 — Approvals granted during the repository-review follow-up session.
- [archive/phase-3-design-decision-log.md](archive/phase-3-design-decision-log.md) — Phase 3 Design Decision Log — Changed: The dashboard command header is being reworked around a full-width mobile question input, larger mode controls, and sheet-like scop…
- [archive/phase-6-reaudit-2026-06-29.md](archive/phase-6-reaudit-2026-06-29.md) — Phase 6 Re-Audit - June 29, 2026 — This pass re-checked the remediation work after the M2 merge and live Supabase migration.
- [archive/rag-scalability-wip-remediation-2026-07-17.md](archive/rag-scalability-wip-remediation-2026-07-17.md) — RAG-scalability WIP review — remediation report (2026-07-17) — Status: F11 shipped and merged;
- [archive/rag-scalability-wip-review-handover-2026-07-15.md](archive/rag-scalability-wip-review-handover-2026-07-15.md) — Handover — RAG scalability WIP review findings (2026-07-15) — Status: findings + remediation plan recorded;
- [archive/search-rag-phase-0-baseline.md](archive/search-rag-phase-0-baseline.md) — Search/RAG Phase 0 Baseline — Date: 2026-06-29 Workspace:
- [archive/search-rag-phase-1-api-validation.md](archive/search-rag-phase-1-api-validation.md) — Search/RAG Phase 1: API Validation Contract — Date: 2026-06-29 Workspace:
- [archive/search-rag-phase-2-answer-plan.md](archive/search-rag-phase-2-answer-plan.md) — Search/RAG Phase 2: Answer Plan Contract — Date: 2026-06-29 Workspace:
- [archive/search-rag-phase-3-synthesis-output.md](archive/search-rag-phase-3-synthesis-output.md) — Phase 3: Synthesis Prompt And Structured Output Hardening — Make the model the final clinical composer while keeping generated output grounded, evidence-ID constrained, and machine-validated before it…
- [archive/search-rag-phase-4-canonical-render-policy.md](archive/search-rag-phase-4-canonical-render-policy.md) — Phase 4: Canonical Render Policy — Prevent noisy answer panels by rendering from a normalized display policy instead of raw RagAnswer field presence.
- [archive/search-rag-phase-5-source-review-ux.md](archive/search-rag-phase-5-source-review-ux.md) — Phase 5: Source Review UX — Make evidence review fast, consistent, clickable, and accessible across desktop and mobile.
- [archive/search-rag-phase-5.5-retrieval-quality-source-selection.md](archive/search-rag-phase-5.5-retrieval-quality-source-selection.md) — Phase 5.5: Retrieval Quality And Source Selection Contract — Fix the remaining retrieval/source-selection failures before final security hardening.
- [archive/search-rag-phase-5.5b-retrieval-follow-up.md](archive/search-rag-phase-5.5b-retrieval-follow-up.md) — Phase 5.5b: Visual Retrieval And Supported-Answer Recovery — Phase 5.5 fixed the first set of targeted retrieval misses, but the follow-up eval still showed two retrieval defects and a separate RAG-eva…
- [archive/search-rag-pre-phase-2-diff-classification.md](archive/search-rag-pre-phase-2-diff-classification.md) — Pre-Phase 2 Dirty Diff Classification — Date: 2026-06-29 Workspace:
- [audit/gate-consolidation-audit-2026-09-02.md](audit/gate-consolidation-audit-2026-09-02.md) — Gate consolidation audit — 2026-09-02 — Status: proposal only.
- [audit/live-design-interaction-audit-2026-08-06.md](audit/live-design-interaction-audit-2026-08-06.md) — Live design & interaction audit — master report — Date: 2026-08-06 App:
- [audit/live-drift-forensics-2026-08.md](audit/live-drift-forensics-2026-08.md) — Live-drift forensics — 2026-08 — Evidence record for the phased database remediation plan and playbook.
- [audit/performance-image-cwv-audit-2026-08-02.md](audit/performance-image-cwv-audit-2026-08-02.md) — Performance, Image & Core Web Vitals Audit — Clinical KB Database — Date: 2026-08-02 Scope:
- [audit/primary-checkout-reconciliation-2026-07-24.md](audit/primary-checkout-reconciliation-2026-07-24.md) — Primary checkout reconciliation — 2026-07-24 — This record covers the dirty primary checkout and the final cloud-chat salvage wave.
- [audit/repo-audit-2026-07-01.md](audit/repo-audit-2026-07-01.md) — Repository Audit — Clinical KB Database — Date: 2026-07-01 Branch:
- [audit/repo-wide-review-remediation-plan-2026-07-23.md](audit/repo-wide-review-remediation-plan-2026-07-23.md) — Repository-wide review remediation completion plan — 2026-07-24 — Complete every outstanding finding from the 2026-07-19 repository-wide review sweep with the smallest safe patches, clear ownership boundari…
- [audit/repo-wide-review-sweep-2026-07-19.md](audit/repo-wide-review-sweep-2026-07-19.md) — Repository-wide review sweep — 2026-07-19 — This was a broad static repository sweep of /workspace/Database on branch work, combining the repo workflow guidance, local static commands,…
- [audit/ux-accessibility-review-2026-07-07.md](audit/ux-accessibility-review-2026-07-07.md) — UX & Accessibility Review — Date: 2026-07-07 Reviewer role:
- [audit/worktree-reconciliation-2026-08-23.md](audit/worktree-reconciliation-2026-08-23.md) — Worktree and branch reconciliation — 2026-08-23 — Disposition: preservation-first;
- [care-plan/CLAUDE-START-HERE.md](care-plan/CLAUDE-START-HERE.md) — Care Plan — Claude start here — Last updated: 22 August 2026 (Australia/Perth) Implementation status:
- [care-plan/HANDOFF-2026-08-24-SUPERSEDED.md](care-plan/HANDOFF-2026-08-24-SUPERSEDED.md) — Care Plan — complete handoff package — Assembled 24 August 2026, when the previous session hit its weekly account limit.
- [care-plan/HANDOFF-START-HERE.md](care-plan/HANDOFF-START-HERE.md) — Care Plan — start here — Rewritten 1 September 2026.
- [care-plan/accessibility-acceptance.md](care-plan/accessibility-acceptance.md) — Care Plan — accessibility and responsive acceptance — What was checked, how, at what size, in what mode — and, just as importantly, what was not checked and therefore remains an open acceptance…
- [care-plan/claude-build-handover-2026-08-21.md](care-plan/claude-build-handover-2026-08-21.md) — ED Care Plans — detailed Claude build handover — ED Care Plans is fully brainstormed, clinically bounded, visually selected, specified, and decomposed into a nine-task implementation plan.
- [care-plan/clinical-language-trace.md](care-plan/clinical-language-trace.md) — Care Plan — clinical language trace — Every consequential label the prototype shows a reader, traced to the glossary term or specification sentence it comes from, and the banned…
- [care-plan/cloud-session.md](care-plan/cloud-session.md) — Care Plan — cloud session brief and progress log — If you are an AI session working on Care Plan in the cloud, this is the first file you read and the last file you write.
- [care-plan/conversation-transcript-2026-08-21.md](care-plan/conversation-transcript-2026-08-21.md) — ED Care Plans — Codex conversation transcript — This is a portable transcript of the conversational text.
- [care-plan/implementation-handoff.md](care-plan/implementation-handoff.md) — Care Plan — implementation handoff — What was built, where it lives, what it deliberately does not do, and what would have to be true before any of it went near a patient.
- [care-plan/interaction-matrix.md](care-plan/interaction-matrix.md) — Care Plan — interaction matrix — Every control in the prototype:
- [care-plan/patient-facing-sheets/README.md](care-plan/patient-facing-sheets/README.md) — The three printed sheets, as text — Committed 2 September 2026 so that a session without access to this machine — a cloud session above all — can read what Care Plan actually p…
- [care-plan/reports/final-fix-report.md](care-plan/reports/final-fix-report.md) — Care Plan — final fix wave — Branch: claude/care-plan-stage-b-9-11 Worktree:
- [care-plan/reports/task-10-report.md](care-plan/reports/task-10-report.md) — Task 10 — Reviews, Team, Governance, History, and System states — Branch claude/care-plan-stage-b-9-11, worktree D:\Worktrees\Database\care-plan-impl.
- [care-plan/reports/task-11-report.md](care-plan/reports/task-11-report.md) — Task 11 — Browser journeys, responsive and accessibility proof, documentation, handoff — Branch claude/care-plan-stage-b-9-11, worktree D:\Worktrees\Database\care-plan-impl.
- [care-plan/reports/task-3-brief.md](care-plan/reports/task-3-brief.md) — task-3-brief
- [care-plan/reports/task-3-report.md](care-plan/reports/task-3-report.md) — Task 3 report — gated route family, literal navigation, responsive clinical shell — Branch claude/ed-care-plans-impl-7f44cd, worktree D:\Worktrees\Database\care-plan-impl, base d421bc2dc.
- [care-plan/reports/task-4-brief.md](care-plan/reports/task-4-brief.md) — task-4-brief
- [care-plan/reports/task-4-report.md](care-plan/reports/task-4-report.md) — Task 4 report — Clinical Snapshot, patient search, Current Plan hierarchy, CMHT actions — Branch claude/ed-care-plans-impl-7f44cd, worktree D:\Worktrees\Database\care-plan-impl.
- [care-plan/reports/task-5-brief.md](care-plan/reports/task-5-brief.md) — task-5-brief
- [care-plan/reports/task-5-report.md](care-plan/reports/task-5-report.md) — Task 5 report — Management Plan reading, pinned safety boundary, and clinician print — Branch claude/ed-care-plans-impl-7f44cd, worktree D:\Worktrees\Database\care-plan-impl.
- [care-plan/reports/task-6-brief.md](care-plan/reports/task-6-brief.md) — task-6-brief
- [care-plan/reports/task-6-report.md](care-plan/reports/task-6-report.md) — Task 6 report — governed Management Plan authoring — Stage B opens with the first authoring surface in the product:
- [care-plan/reports/task-7-brief.md](care-plan/reports/task-7-brief.md) — task-7-brief
- [care-plan/reports/task-7-report.md](care-plan/reports/task-7-report.md) — Task 7 report — ED Presentation timeline, concise recording, plan-use feedback, and visible amendments — Branch claude/ed-care-plans-impl-7f44cd, worktree D:\Worktrees\Database\care-plan-impl.
- [care-plan/reports/task-8-brief.md](care-plan/reports/task-8-brief.md) — task-8-brief
- [care-plan/reports/task-8-report.md](care-plan/reports/task-8-report.md) — Task 8 report — the patient's own Personal Safety Plan, its versioning, and its printed copy — Worktree D:\Worktrees\Database\care-plan-impl, branch claude/ed-care-plans-impl-7f44cd.
- [care-plan/reports/task-9-brief.md](care-plan/reports/task-9-brief.md) — task-9-brief
- [care-plan/reports/task-9-report.md](care-plan/reports/task-9-report.md) — Task 9 report — Patient Plan — Commit: f4de82034 — feat(care-plan):
- [care-plan/reports/task-d1-report.md](care-plan/reports/task-d1-report.md) — Task D1 — the moment the person's part was recorded — Status: COMPLETE. Fast checks only, by user instruction (D2).
- [care-plan/session-handoff-2026-08-21.md](care-plan/session-handoff-2026-08-21.md) — Care Plan — session handoff, 21 August 2026 — Written at the end of the controlling Claude session that designed Care Plan and built Tasks 1 and 2.
- [care-plan/session-handoff-2026-08-23.md](care-plan/session-handoff-2026-08-23.md) — Care Plan — session handoff, 23 August 2026 — Written at the moment the session was closed, mid-task.
- [care-plan/verification-log-2026-08-21.md](care-plan/verification-log-2026-08-21.md) — ED Care Plans — handover verification log — This log records evidence for the design/planning/handover package only.
- [care-plan/verification-report.md](care-plan/verification-report.md) — Care Plan — verification report (Task 11) — Exact commands, exit codes, result lines, failures, and — just as important — the checks that were not run and why.
- [caring-contacts/PROGRESS-LEDGER.md](caring-contacts/PROGRESS-LEDGER.md) — Caring Contacts — master progress ledger — One place to see everything built so far, across every session.
- [caring-contacts/accessibility-acceptance.md](caring-contacts/accessibility-acceptance.md) — Caring Contact accessibility acceptance — Focused Chromium evidence covers keyboard, focus, responsive geometry, dark, forced-colour, reduced-motion and zoom-reflow contracts.
- [caring-contacts/clinical-language-trace.md](caring-contacts/clinical-language-trace.md) — Caring Contact clinical-language trace — This trace freezes the programme boundary used by the linked prototype.
- [caring-contacts/copy-decisions-recommended.md](caring-contacts/copy-decisions-recommended.md) — Caring Contacts — the copy decisions, with a recommendation for each — Written 2026-08-24, approved the same day, and NOT YET IMPLEMENTED.
- [caring-contacts/copy-review.md](caring-contacts/copy-review.md) — Caring Contacts — copy review — This is every word a human being can currently read anywhere in the Caring Contacts workspace, gathered in one place so you can mark it up.
- [caring-contacts/interaction-matrix.md](caring-contacts/interaction-matrix.md) — Caring Contact interaction matrix — The source of truth is completionOverlayDefinitions in src/components/caring-contacts/mockups/overlay-specimens.tsx.
- [caring-contacts/linked-prototype-handoff.md](caring-contacts/linked-prototype-handoff.md) — Caring Contact linked prototype handoff — This prototype is a fully linked, synthetic design-validation experience at /mockups/caring-contacts.
- [caring-contacts/phase-1-handoff.md](caring-contacts/phase-1-handoff.md) — Caring Contacts Phase 1 — handoff — Status: Phase 1 complete and verified, 19 August 2026.
- [caring-contacts/phase-2a-build-record.md](caring-contacts/phase-2a-build-record.md) — Caring Contacts Phase 2A — tracked build record — THIS FILE IS NOW THE LEDGER ITSELF, not a copy of one.
- [caring-contacts/phase-2a-continuation-prompt.md](caring-contacts/phase-2a-continuation-prompt.md) — Caring Contacts Phase 2A — continuation prompt — Paste the block below as the first message of a new Claude Code session.
- [caring-contacts/phase-2a-handoff.md](caring-contacts/phase-2a-handoff.md) — Caring Contacts Phase 2A — session handoff — Read this first. It is the single entry point for continuing the Caring Contacts production build in a new session, a new machine, or a new…
- [caring-contacts/phase-2a-sdd-archive/00-live-ledger-verbatim.md](caring-contacts/phase-2a-sdd-archive/00-live-ledger-verbatim.md) — SDD ledger — plan: docs/superpowers/plans/2026-08-19-caring-contact-phase-2a-foundations.md — Spec: docs/superpowers/specs/2026-08-19-caring-contact-production-build-design.md (read).
- [caring-contacts/phase-2a-sdd-archive/condensed-service-bar-report.md](caring-contacts/phase-2a-sdd-archive/condensed-service-bar-report.md) — Condensed service-stop bar — report — Closes the defect Task 19's browser proof measured:
- [caring-contacts/phase-2a-sdd-archive/final-fix-wave-a-report.md](caring-contacts/phase-2a-sdd-archive/final-fix-wave-a-report.md) — Final fix wave A — storage and sealed domain — Scope: the storage/sealed-domain half of the final whole-branch review.
- [caring-contacts/phase-2a-sdd-archive/final-fix-wave-b-report.md](caring-contacts/phase-2a-sdd-archive/final-fix-wave-b-report.md) — Final fix wave — half B: surface, schema and gate — Seven findings from the final whole-branch review.
- [caring-contacts/phase-2a-sdd-archive/task-1-brief.md](caring-contacts/phase-2a-sdd-archive/task-1-brief.md) — task-1-brief
- [caring-contacts/phase-2a-sdd-archive/task-1-report.md](caring-contacts/phase-2a-sdd-archive/task-1-report.md) — Task 1 report: patient-visible copy moves into the sealed domain — Worktree: D:\Repos\Database\.claude\worktrees\rag-readability-metric-split-7e8ac4 Branch:
- [caring-contacts/phase-2a-sdd-archive/task-10-brief.md](caring-contacts/phase-2a-sdd-archive/task-10-brief.md) — task-10-brief
- [caring-contacts/phase-2a-sdd-archive/task-10-report.md](caring-contacts/phase-2a-sdd-archive/task-10-report.md) — Task 10 report — extend the storage contract and the in-memory store — REPOSITORY_REFUSALS entries;
- [caring-contacts/phase-2a-sdd-archive/task-11-brief.md](caring-contacts/phase-2a-sdd-archive/task-11-brief.md) — task-11-brief
- [caring-contacts/phase-2a-sdd-archive/task-11a-brief.md](caring-contacts/phase-2a-sdd-archive/task-11a-brief.md) — task-11a-brief
- [caring-contacts/phase-2a-sdd-archive/task-11a-report.md](caring-contacts/phase-2a-sdd-archive/task-11a-report.md) — Task 11a report — Migration 0003, the workspace schema — Status: DONE_WITH_CONCERNS Commit:
- [caring-contacts/phase-2a-sdd-archive/task-11b-brief.md](caring-contacts/phase-2a-sdd-archive/task-11b-brief.md) — task-11b-brief
- [caring-contacts/phase-2a-sdd-archive/task-11b-report.md](caring-contacts/phase-2a-sdd-archive/task-11b-report.md) — task-11b-report
- [caring-contacts/phase-2a-sdd-archive/task-12-13-report.md](caring-contacts/phase-2a-sdd-archive/task-12-13-report.md) — Task 12 & 13 report — the server-side seam (database config + demo role switcher) — Status: DONE Commits:
- [caring-contacts/phase-2a-sdd-archive/task-12-brief.md](caring-contacts/phase-2a-sdd-archive/task-12-brief.md) — task-12-brief
- [caring-contacts/phase-2a-sdd-archive/task-13-brief.md](caring-contacts/phase-2a-sdd-archive/task-13-brief.md) — task-13-brief
- [caring-contacts/phase-2a-sdd-archive/task-14-brief.md](caring-contacts/phase-2a-sdd-archive/task-14-brief.md) — task-14-brief
- [caring-contacts/phase-2a-sdd-archive/task-14-report.md](caring-contacts/phase-2a-sdd-archive/task-14-report.md) — Follow-up round — Rulings 45 to 48 — Type change (sealed domain, src/lib/caring-contacts/access-audit.ts):
- [caring-contacts/phase-2a-sdd-archive/task-15-brief.md](caring-contacts/phase-2a-sdd-archive/task-15-brief.md) — task-15-brief
- [caring-contacts/phase-2a-sdd-archive/task-15-report.md](caring-contacts/phase-2a-sdd-archive/task-15-report.md) — Task 15 report — the route group, the four width states, and the inbound link — The route group, the width-state module, the shell, the route table and the tools-catalogue front door are all built, tested and committed.
- [caring-contacts/phase-2a-sdd-archive/task-16-brief.md](caring-contacts/phase-2a-sdd-archive/task-16-brief.md) — task-16-brief
- [caring-contacts/phase-2a-sdd-archive/task-16-report.md](caring-contacts/phase-2a-sdd-archive/task-16-report.md) — Task 16 report — the service-state banner and the explained-automation contract — Branch claude/suicide-contact-mockup-b5aaa0, worktree D:\Worktrees\Database\cc-2a-live.
- [caring-contacts/phase-2a-sdd-archive/task-17-brief.md](caring-contacts/phase-2a-sdd-archive/task-17-brief.md) — task-17-brief
- [caring-contacts/phase-2a-sdd-archive/task-17-report.md](caring-contacts/phase-2a-sdd-archive/task-17-report.md) — Task 17 report — the frozen 24-row overlay definition table — Two new source files plus this report.
- [caring-contacts/phase-2a-sdd-archive/task-18-brief.md](caring-contacts/phase-2a-sdd-archive/task-18-brief.md) — task-18-brief
- [caring-contacts/phase-2a-sdd-archive/task-18-report.md](caring-contacts/phase-2a-sdd-archive/task-18-report.md) — Task 18 report — one renderer, twenty-four overlays — Status: complete. All nine rules of task-18-brief.md are implemented, the brief's test file is green, all four required mutations were prove…
- [caring-contacts/phase-2a-sdd-archive/task-19-brief.md](caring-contacts/phase-2a-sdd-archive/task-19-brief.md) — task-19-brief
- [caring-contacts/phase-2a-sdd-archive/task-19-report.md](caring-contacts/phase-2a-sdd-archive/task-19-report.md) — Task 19 — browser proof at the six required widths, and the close of Phase 2A — Branch claude/suicide-contact-mockup-b5aaa0, worktree D:\Worktrees\Database\cc-2a-live.
- [caring-contacts/phase-2a-sdd-archive/task-2-brief.md](caring-contacts/phase-2a-sdd-archive/task-2-brief.md) — task-2-brief
- [caring-contacts/phase-2a-sdd-archive/task-2-report.md](caring-contacts/phase-2a-sdd-archive/task-2-report.md) — Task 2 report — roles and actions for the work Phase 1 never implemented — registry order given in the brief:
- [caring-contacts/phase-2a-sdd-archive/task-3-brief.md](caring-contacts/phase-2a-sdd-archive/task-3-brief.md) — task-3-brief
- [caring-contacts/phase-2a-sdd-archive/task-3-report.md](caring-contacts/phase-2a-sdd-archive/task-3-report.md) — Task 3 report — Service safety stop — Status: DONE Worktree:
- [caring-contacts/phase-2a-sdd-archive/task-4-brief.md](caring-contacts/phase-2a-sdd-archive/task-4-brief.md) — task-4-brief
- [caring-contacts/phase-2a-sdd-archive/task-4-report.md](caring-contacts/phase-2a-sdd-archive/task-4-report.md) — Task 4 report — Pathway versions and dual approval — 33d38ca0c — feat(caring-contacts):
- [caring-contacts/phase-2a-sdd-archive/task-5-7-report.md](caring-contacts/phase-2a-sdd-archive/task-5-7-report.md) — Task 5-7 report: referrals, plan ownership/coverage, contact rescheduling — Worktree: D:\Repos\Database\.claude\worktrees\rag-readability-metric-split-7e8ac4 Branch:
- [caring-contacts/phase-2a-sdd-archive/task-5-brief.md](caring-contacts/phase-2a-sdd-archive/task-5-brief.md) — task-5-brief
- [caring-contacts/phase-2a-sdd-archive/task-6-brief.md](caring-contacts/phase-2a-sdd-archive/task-6-brief.md) — task-6-brief
- [caring-contacts/phase-2a-sdd-archive/task-7-brief.md](caring-contacts/phase-2a-sdd-archive/task-7-brief.md) — task-7-brief
- [caring-contacts/phase-2a-sdd-archive/task-8-9-report.md](caring-contacts/phase-2a-sdd-archive/task-8-9-report.md) — Task 8 + Task 9 report — access auditing, notification preferences, training ownership — Worktree: D:\Repos\Database\.claude\worktrees\rag-readability-metric-split-7e8ac4 Branch:
- [caring-contacts/phase-2a-sdd-archive/task-8-brief.md](caring-contacts/phase-2a-sdd-archive/task-8-brief.md) — task-8-brief
- [caring-contacts/phase-2a-sdd-archive/task-9-brief.md](caring-contacts/phase-2a-sdd-archive/task-9-brief.md) — task-9-brief
- [caring-contacts/phase-2a-visual-differences.md](caring-contacts/phase-2a-visual-differences.md) — Caring Contacts Phase 2A — visual differences against the mockup atlas — Recorded by Task 19, the closing task of Phase 2A.
- [caring-contacts/phase-2b-CONTINUATION-PROMPT.md](caring-contacts/phase-2b-CONTINUATION-PROMPT.md) — Caring Contacts Phase 2B — continuation brief for a fresh session — Read this file first, then the four documents in §1.
- [caring-contacts/phase-2b-HANDOVER.md](caring-contacts/phase-2b-HANDOVER.md) — Caring Contacts Phase 2B — handover — Written 2026-08-26 by the controller of the subagent-driven build.
- [caring-contacts/phase-2b-build-record.md](caring-contacts/phase-2b-build-record.md) — SDD ledger — plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md — This is the Phase 2B build record and the SDD ledger, in one tracked file.
- [caring-contacts/phase-2b-pr-body.md](caring-contacts/phase-2b-pr-body.md) — Caring Contacts Phase 2B — prepared pull-request body — This file is the PR description, held here until the owner asks for the pull request to be opened.
- [caring-contacts/phase-2b-sdd-archive/STANDING-DISCIPLINE.md](caring-contacts/phase-2b-sdd-archive/STANDING-DISCIPLINE.md) — Standing verification discipline — read once, applies to every Caring Contacts task — Every brief in this programme referenced these rules in full, which cost about forty lines per brief and drifted between them.
- [caring-contacts/phase-2b-sdd-archive/group-4-review.md](caring-contacts/phase-2b-sdd-archive/group-4-review.md) — Group 4 review — Tasks 17 and 18, the team read and the Team screen — Reviewer verdicts.…
- [caring-contacts/phase-2b-sdd-archive/group-4-round-1-report.md](caring-contacts/phase-2b-sdd-archive/group-4-round-1-report.md) — Group 4 fix round 1 — the false bound, the invisible backlog, and four smaller things — Status: complete. Branch claude/browser-test-gate-handoff-d5c1db, worktree browser-test-gate-handoff-d5c1db.
- [caring-contacts/phase-2b-sdd-archive/main-catchup-inventory.md](caring-contacts/phase-2b-sdd-archive/main-catchup-inventory.md) — Main catch-up inventory — what origin/main holds that this trunk does not — Written before the catch-up merge of origin/main into claude/browser-test-gate-handoff-d5c1db, so the merge can be audited against it afterw…
- [caring-contacts/phase-2b-sdd-archive/merge-checklist.md](caring-contacts/phase-2b-sdd-archive/merge-checklist.md) — Merge checklist — the controller's own work, owed at the merge point — Four branches merge into the trunk claude/browser-test-gate-handoff-d5c1db.
- [caring-contacts/phase-2b-sdd-archive/retention-and-anchor-report.md](caring-contacts/phase-2b-sdd-archive/retention-and-anchor-report.md) — Retention clearance and the unclaimed-work anchor — implementer report — Two owner-approved changes, built together because both needed a migration and two separate migrations to caring-contacts/supabase/migration…
- [caring-contacts/phase-2b-sdd-archive/task-1-brief.md](caring-contacts/phase-2b-sdd-archive/task-1-brief.md) — Task 1 brief — the shared empty-state component — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 0, Task 1.
- [caring-contacts/phase-2b-sdd-archive/task-1-report.md](caring-contacts/phase-2b-sdd-archive/task-1-report.md) — Task 1 report — the shared empty-state component — Branch: claude/browser-test-gate-handoff-d5c1db.
- [caring-contacts/phase-2b-sdd-archive/task-10-brief.md](caring-contacts/phase-2b-sdd-archive/task-10-brief.md) — Task 10 brief — plan and contact detail — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 1, Task 10.
- [caring-contacts/phase-2b-sdd-archive/task-10-report.md](caring-contacts/phase-2b-sdd-archive/task-10-report.md) — Task 10 report — plan and contact detail — Worktree: D:\Worktrees\Database\cc-plan-detail · Branch:
- [caring-contacts/phase-2b-sdd-archive/task-11a-brief.md](caring-contacts/phase-2b-sdd-archive/task-11a-brief.md) — Task 11a brief — Group 1's wizard, inspection and outcome overlays — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 1, Task 11.
- [caring-contacts/phase-2b-sdd-archive/task-11a-report.md](caring-contacts/phase-2b-sdd-archive/task-11a-report.md) — Task 11a report — Group 1's wizard, inspection and outcome overlays — Worktree: D:\Worktrees\Database\cc-plan-detail · Branch:
- [caring-contacts/phase-2b-sdd-archive/task-11b-brief.md](caring-contacts/phase-2b-sdd-archive/task-11b-brief.md) — Task 11b brief — pause, withdrawal and reassignment — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 1, Task 11.
- [caring-contacts/phase-2b-sdd-archive/task-11b-report.md](caring-contacts/phase-2b-sdd-archive/task-11b-report.md) — Task 11b report — pause, withdrawal and reassignment — Worktree: D:\Worktrees\Database\cc-plan-detail · Branch:
- [caring-contacts/phase-2b-sdd-archive/task-11b-review.md](caring-contacts/phase-2b-sdd-archive/task-11b-review.md) — Task 11b review — pause, withdrawal and reassignment — Reviewed: fe721ce70, 541345e8c, f3ee88113, ec4f6b1cb against merge base 23ab19bb0, plus the report at 9a64f7b6f.
- [caring-contacts/phase-2b-sdd-archive/task-11b-round-1-report.md](caring-contacts/phase-2b-sdd-archive/task-11b-round-1-report.md) — Task 11b, fix round 1 — the silent commit, the key that outlived its submission, and the copy nobody read — Worktree: D:\Worktrees\Database\cc-plan-detail · Branch:
- [caring-contacts/phase-2b-sdd-archive/task-11b-round-1-review.md](caring-contacts/phase-2b-sdd-archive/task-11b-round-1-review.md) — Task 11b, fix round 1 — scoped re-review — Reviewed: f2d23c425, a43bc7728, 8b98e2a17, 487cb2ed7, 9cb661a29, 230d1b411, b8313a791, against the review they answer at 72c4477b3.
- [caring-contacts/phase-2b-sdd-archive/task-11b-round-2-report.md](caring-contacts/phase-2b-sdd-archive/task-11b-round-2-report.md) — Task 11b, fix round 2 — the window after a move, and three assertions that were reading themselves — Worktree: D:\Worktrees\Database\cc-plan-detail · Branch:
- [caring-contacts/phase-2b-sdd-archive/task-12-brief.md](caring-contacts/phase-2b-sdd-archive/task-12-brief.md) — Task 12 brief — the schedule read — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 2, Task 12.
- [caring-contacts/phase-2b-sdd-archive/task-12-report.md](caring-contacts/phase-2b-sdd-archive/task-12-report.md) — Task 12 — the schedule read — Group 2's read: what a team's caring-contact plans hold on a given AWST day, and what each day's three sending windows contain.
- [caring-contacts/phase-2b-sdd-archive/task-13-brief.md](caring-contacts/phase-2b-sdd-archive/task-13-brief.md) — Task 13 brief — the Schedule screen — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 2, Task 13.
- [caring-contacts/phase-2b-sdd-archive/task-13-report.md](caring-contacts/phase-2b-sdd-archive/task-13-report.md) — Task 13 — the Schedule screen — Group 2's screen: what this team's caring-contact plans put on one AWST day, in the three approved sending windows, with the contacts that s…
- [caring-contacts/phase-2b-sdd-archive/task-13b-brief.md](caring-contacts/phase-2b-sdd-archive/task-13b-brief.md) — Task 13b brief — reveal one patient's name, one act at a time — Owner decision, 2026-08-26.
- [caring-contacts/phase-2b-sdd-archive/task-13b-report.md](caring-contacts/phase-2b-sdd-archive/task-13b-report.md) — Task 13b - the per-row name reveal, deferred on this task's own finding — This is not work that was never attempted.
- [caring-contacts/phase-2b-sdd-archive/task-14-brief.md](caring-contacts/phase-2b-sdd-archive/task-14-brief.md) — Task 14 brief — contact and delivery exception, and this group's overlays — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 2, Task 14.
- [caring-contacts/phase-2b-sdd-archive/task-14-report.md](caring-contacts/phase-2b-sdd-archive/task-14-report.md) — Task 14 — contact and delivery exception, and this group's overlays — Group 2's write surface:
- [caring-contacts/phase-2b-sdd-archive/task-15-brief.md](caring-contacts/phase-2b-sdd-archive/task-15-brief.md) — Task 15 brief — the templates library — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 3, Task 15.
- [caring-contacts/phase-2b-sdd-archive/task-15-report.md](caring-contacts/phase-2b-sdd-archive/task-15-report.md) — Task 15 report — the templates library — Branch: claude/caring-contacts-demo-seed · Worktree:
- [caring-contacts/phase-2b-sdd-archive/task-16-brief.md](caring-contacts/phase-2b-sdd-archive/task-16-brief.md) — Task 16 brief — template detail, dual approval, and this group's overlays — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 3, Task 16.
- [caring-contacts/phase-2b-sdd-archive/task-16-report.md](caring-contacts/phase-2b-sdd-archive/task-16-report.md) — Task 16 report — the template detail record, dual approval, and this group's overlays — Branch: claude/caring-contacts-demo-seed · Worktree:
- [caring-contacts/phase-2b-sdd-archive/task-16-review.md](caring-contacts/phase-2b-sdd-archive/task-16-review.md) — Task 16 review — template detail, dual approval, and this group's overlays — Reviewed: base 33f2106e8b2f4bcd47495f98431a7825a6c80bc8 → head ef1fa954b9fb54bcbab72c68eabc1afba32385bd, branch claude/caring-contacts-demo-…
- [caring-contacts/phase-2b-sdd-archive/task-16-round-1-report.md](caring-contacts/phase-2b-sdd-archive/task-16-round-1-report.md) — Task 16 — fix round 1 report — Branch: claude/caring-contacts-demo-seed · Worktree:
- [caring-contacts/phase-2b-sdd-archive/task-17-report.md](caring-contacts/phase-2b-sdd-archive/task-17-report.md) — Task 17 — the team read — Status: complete. Branch claude/browser-test-gate-handoff-d5c1db, nothing pushed, no PR, no subagents.
- [caring-contacts/phase-2b-sdd-archive/task-18-report.md](caring-contacts/phase-2b-sdd-archive/task-18-report.md) — Task 18 — the Team screen — Status: complete. Branch claude/browser-test-gate-handoff-d5c1db, nothing pushed, no PR, no subagents.
- [caring-contacts/phase-2b-sdd-archive/task-19-brief.md](caring-contacts/phase-2b-sdd-archive/task-19-brief.md) — Task 19 brief — Guidance and Reports — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 5, Task 19.
- [caring-contacts/phase-2b-sdd-archive/task-19-report.md](caring-contacts/phase-2b-sdd-archive/task-19-report.md) — Task 19 report — Guidance and Reports, and the More-panel navigation — Branch: claude/caring-contacts-demo-seed.
- [caring-contacts/phase-2b-sdd-archive/task-20-report.md](caring-contacts/phase-2b-sdd-archive/task-20-report.md) — Task 20 — every overlay trigger, reconciled against all twenty-four frozen rows — Run on the merged tree, per Ruling [133].
- [caring-contacts/phase-2b-sdd-archive/task-21-report.md](caring-contacts/phase-2b-sdd-archive/task-21-report.md) — Task 21 — the responsive and accessibility proof, per screen and per condition — Run on the merged tree, per Ruling [133].
- [caring-contacts/phase-2b-sdd-archive/task-3-brief.md](caring-contacts/phase-2b-sdd-archive/task-3-brief.md) — Task 3 brief — the overlay trigger, and the commit contract that must ship with it — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 0, Task 3.
- [caring-contacts/phase-2b-sdd-archive/task-3-report.md](caring-contacts/phase-2b-sdd-archive/task-3-report.md) — Task 3 report — the overlay trigger, and the commit contract that shipped with it — Branch claude/browser-test-gate-handoff-d5c1db, base f65dd39d3.
- [caring-contacts/phase-2b-sdd-archive/task-5-brief.md](caring-contacts/phase-2b-sdd-archive/task-5-brief.md) — Task 5 brief — the Patients directory (absorbing Task 4) — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 1, Task 5.
- [caring-contacts/phase-2b-sdd-archive/task-5-report.md](caring-contacts/phase-2b-sdd-archive/task-5-report.md) — Task 5 report — the Patients directory (absorbing Task 4) — Status: complete, on branch claude/browser-test-gate-handoff-d5c1db, base bb03d00b5.
- [caring-contacts/phase-2b-sdd-archive/task-5b-brief.md](caring-contacts/phase-2b-sdd-archive/task-5b-brief.md) — Task 5b brief — the names-only patient projection — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 1.
- [caring-contacts/phase-2b-sdd-archive/task-5b-report.md](caring-contacts/phase-2b-sdd-archive/task-5b-report.md) — Task 5b report — the names-only patient projection — Branch claude/browser-test-gate-handoff-d5c1db, base e3d1fa6f3.
- [caring-contacts/phase-2b-sdd-archive/task-6-brief.md](caring-contacts/phase-2b-sdd-archive/task-6-brief.md) — Task 6 brief — the Patient overview screen — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 1, Task 6.
- [caring-contacts/phase-2b-sdd-archive/task-6-report.md](caring-contacts/phase-2b-sdd-archive/task-6-report.md) — Task 6 report — the Patient overview screen — Branch: claude/browser-test-gate-handoff-d5c1db.
- [caring-contacts/phase-2b-sdd-archive/task-6b-brief.md](caring-contacts/phase-2b-sdd-archive/task-6b-brief.md) — Task 6b brief — store the reason a first contact date was moved — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 1 (added after Task 6, on the owner's decision of 2026-08-…
- [caring-contacts/phase-2b-sdd-archive/task-6b-report.md](caring-contacts/phase-2b-sdd-archive/task-6b-report.md) — Task 6b report — the reason a first contact date was moved is now kept — Status: DONE_WITH_CONCERNS (three concerns, none blocking;
- [caring-contacts/phase-2b-sdd-archive/task-7-brief.md](caring-contacts/phase-2b-sdd-archive/task-7-brief.md) — Task 7 brief — the activation wizard's shell, and stages 1 and 2 — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 1, Tasks 7–9.
- [caring-contacts/phase-2b-sdd-archive/task-7-report.md](caring-contacts/phase-2b-sdd-archive/task-7-report.md) — Task 7 report — the activation wizard's route, shell, and stages 1 and 2 — Branch: claude/browser-test-gate-handoff-d5c1db.
- [caring-contacts/phase-2b-sdd-archive/task-8-brief.md](caring-contacts/phase-2b-sdd-archive/task-8-brief.md) — Task 8 brief — stage 3, personalisation — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 1, Task 8.
- [caring-contacts/phase-2b-sdd-archive/task-8-report.md](caring-contacts/phase-2b-sdd-archive/task-8-report.md) — Task 8 report — stage 3, personalisation — Branch: claude/browser-test-gate-handoff-d5c1db.
- [caring-contacts/phase-2b-sdd-archive/task-9-brief.md](caring-contacts/phase-2b-sdd-archive/task-9-brief.md) — Task 9 brief — stage 4, review and activation — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 1, Task 9.
- [caring-contacts/phase-2b-sdd-archive/task-9-report.md](caring-contacts/phase-2b-sdd-archive/task-9-report.md) — Task 9 report — stage 4, review and activation — Branch: claude/browser-test-gate-handoff-d5c1db.
- [caring-contacts/phase-2b-sdd-archive/task-9b-brief.md](caring-contacts/phase-2b-sdd-archive/task-9b-brief.md) — Task 9b brief — store the stage-1 assurances as an attestation — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, Group 1 (added after Task 9, on the owner's decision of 2026-08-…
- [caring-contacts/phase-2b-sdd-archive/task-9b-report.md](caring-contacts/phase-2b-sdd-archive/task-9b-report.md) — Task 9b report — the stage-1 confirmations, recorded as an attestation — Status: implemented and verified.
- [caring-contacts/phase-2b-sdd-archive/task-c-brief.md](caring-contacts/phase-2b-sdd-archive/task-c-brief.md) — Task C brief — the owner's six approved copy and message-policy changes — Plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md, "Task C".
- [caring-contacts/phase-2b-sdd-archive/task-c-report.md](caring-contacts/phase-2b-sdd-archive/task-c-report.md) — Task C report — the owner's six approved copy and message-policy changes — Branch: claude/browser-test-gate-handoff-d5c1db.
- [caring-contacts/phase-2b-sdd-archive/task-exit-only-trigger-report.md](caring-contacts/phase-2b-sdd-archive/task-exit-only-trigger-report.md) — Task report — collapsing the two ExitOnlyOverlayTrigger implementations — Status: COMPLETE. The adjudication recorded in docs/caring-contacts/phase-2b-build-record.md ("The duplicate ExitOnlyOverlayTrigger, adjudic…
- [caring-contacts/phase-2b-sdd-archive/task-p-brief.md](caring-contacts/phase-2b-sdd-archive/task-p-brief.md) — Task P brief — the message uses the patient's first name — Owner decision, 2026-08-26.
- [caring-contacts/phase-2b-sdd-archive/task-p-report.md](caring-contacts/phase-2b-sdd-archive/task-p-report.md) — Task P report — the patient-visible message uses the patient's first name — Branch claude/caring-contacts-message-name, worktree D:\Worktrees\Database\cc-message-name.
- [caring-contacts/phase-2b-sdd-archive/task-p-round-2-review.md](caring-contacts/phase-2b-sdd-archive/task-p-round-2-review.md) — Task P round 2 — scoped re-review — Verdict: round 2 is SAFE TO MERGE.
- [caring-contacts/phase-2b-sdd-archive/task-privacy-url-report.md](caring-contacts/phase-2b-sdd-archive/task-privacy-url-report.md) — Task: a patient's name must never reach the caseload URL (Ruling [111]) — Branch claude/browser-test-gate-handoff-d5c1db, worktree .claude/worktrees/browser-test-gate-handoff-d5c1db.
- [caring-contacts/phase-2b-sdd-archive/task-safety-fixes-report.md](caring-contacts/phase-2b-sdd-archive/task-safety-fixes-report.md) — Task report — the two post-merge safety fixes (Rulings [143] and [144]) — Worktree browser-test-gate-handoff-d5c1db, branch claude/browser-test-gate-handoff-d5c1db — the merged trunk.
- [caring-contacts/phase-2b-sdd-archive/task-seed-brief.md](caring-contacts/phase-2b-sdd-archive/task-seed-brief.md) — Task SEED brief — make the demo drivable — Owner decision, 2026-08-26.
- [caring-contacts/phase-2b-sdd-archive/task-seed-report.md](caring-contacts/phase-2b-sdd-archive/task-seed-report.md) — Task SEED report — make the demo drivable — Status: DONE_WITH_CONCERNS, after fix round 1.
- [caring-contacts/phase-2b-sdd-archive/whole-branch-review.md](caring-contacts/phase-2b-sdd-archive/whole-branch-review.md) — Whole-branch review — Caring Contacts Phase 2B — Run on the merged trunk, branch claude/browser-test-gate-handoff-d5c1db, at 40ac6d240db92b4e7a163875f3c0d0c24e50902b.
- [caring-contacts/task-seed-timeline-report.md](caring-contacts/task-seed-timeline-report.md) — Task: make Rowan's seeded timeline coherent (Ruling 159) — The previous round of the demo seed (e45dfefc5) discharged Rowan's plan one AWST day before "now" (dischargeDaysBeforeShared:
- [caring-contacts/task-seed-wireframe-report.md](caring-contacts/task-seed-wireframe-report.md) — Task: extend the demo seed so the wireframe reads as working — The seed (src/lib/caring-contacts-server/demo-seed.ts) produced three plans (running, paused, withdrawn) but nobody had ever claimed one, no…
- [caring-contacts/verification-report.md](caring-contacts/verification-report.md) — Caring Contact linked prototype verification — This report covers the uncommitted, mockup-only Caring Contact linked prototype in the dedicated codex/caring-contact-linked-mockup worktree.
- [caring-contacts/visual-reference-manifest.md](caring-contacts/visual-reference-manifest.md) — Caring Contact approved visual-reference manifest — These ten boards were inspected from the older read-only Caring Contact design worktree.
- [superpowers/plans/2026-07-04-public-anonymous-access-rate-limits.md](superpowers/plans/2026-07-04-public-anonymous-access-rate-limits.md) — Public Anonymous Access and Rate Limiting Implementation Plan — Goal: Remove the forced sign-in/authorization barrier so anonymous users can run live searches, generate answers, browse/view source documen…
- [superpowers/plans/2026-07-24-webkit-rsc-prefetch-disposition.md](superpowers/plans/2026-07-24-webkit-rsc-prefetch-disposition.md) — WebKit RSC Prefetch Disposition Implementation Plan — Goal: Disposition issue #024 by proving whether the WebKit _rsc access-control page error is caused by the route-coverage harness, applying…
- [superpowers/plans/2026-08-05-editable-pin-menu-mockups.md](superpowers/plans/2026-08-05-editable-pin-menu-mockups.md) — Search + Editable Pins Menu — Implementation Record — Perfect /mockups/search-lens-menu around editable app-destination pins while preserving the original visual direction.
- [superpowers/plans/2026-08-14-caring-contact-coordination-rollout.md](superpowers/plans/2026-08-14-caring-contact-coordination-rollout.md) — Caring Contact Coordination Workspace — Repository-Native Rollout Plan — Goal: Deliver a premium, responsive, one-way caring-contact coordination workspace for WA hospital services, beginning with an approved visu…
- [superpowers/plans/2026-08-14-ward-management-mockups.md](superpowers/plans/2026-08-14-ward-management-mockups.md) — Ward Management Mockup Generation Plan — Goal: Produce and validate three independent desktop visual directions for the approved synthetic WA mental-health ward-management command m…
- [superpowers/plans/2026-08-15-caring-contact-design-phase.md](superpowers/plans/2026-08-15-caring-contact-design-phase.md) — Caring Contact Coordination Design Phase Implementation Plan — Goal: Produce the repository-native, clinically bounded, responsive design specification and complete synthetic visual suite required to app…
- [superpowers/plans/2026-08-18-ward-flow-model-and-modes.md](superpowers/plans/2026-08-18-ward-flow-model-and-modes.md) — Ward Flow model correction and missing modes — Implementation Plan — Goal: Close the four model defects that let Ward Flow propose an unlawful or impossible placement, then add the four modes the WA pathway ne…
- [superpowers/plans/2026-08-18-ward-flow-phase-1-model.md](superpowers/plans/2026-08-18-ward-flow-phase-1-model.md) — Ward Flow Phase 1 — the model — Implementation Plan — Goal: Replace the flat hospital/patient fixture with a model that can express WA metro psychiatry patient flow correctly — sites that have e…
- [superpowers/plans/2026-08-18-ward-flow-phase-2-coordinator-screen.md](superpowers/plans/2026-08-18-ward-flow-phase-2-coordinator-screen.md) — Ward Flow Phase 2 — the coordinator screen — Implementation Plan — Goal: Build the flow coordinator's single screen — the one surface that replaces the phone-around — and retire Constellation into it.
- [superpowers/plans/2026-08-19-caring-contact-domain-and-datastore.md](superpowers/plans/2026-08-19-caring-contact-domain-and-datastore.md) — Caring Contacts Domain and Datastore Implementation Plan — Goal: Build the sealed Caring Contacts domain rules layer and its dedicated datastore, on synthetic data only, so that every scheduling, lif…
- [superpowers/plans/2026-08-19-caring-contact-phase-2a-foundations.md](superpowers/plans/2026-08-19-caring-contact-phase-2a-foundations.md) — Caring Contacts Phase 2A — Foundations Implementation Plan — Goal: Complete the sealed rules layer and storage that the undesigned screens need, put a real production Caring Contacts workspace shell on…
- [superpowers/plans/2026-08-19-ward-flow-phase-3-role-screens.md](superpowers/plans/2026-08-19-ward-flow-phase-3-role-screens.md) — Ward Flow Phase 3 — the other three roles — Implementation Plan — Goal: Make Ward Flow move — add the emergency department, ward and transport officer screens plus the coordinator's live tracker, on top of…
- [superpowers/plans/2026-08-20-rag-adaptive-answer.md](superpowers/plans/2026-08-20-rag-adaptive-answer.md) — Adaptive RAG answer and display — Implementation Plan — Goal: Extend the landed v19 moderate-length/related-information contract into evidence-gated adaptive answers, and remove the independent si…
- [superpowers/plans/2026-08-20-rag-australian-source-governance.md](superpowers/plans/2026-08-20-rag-australian-source-governance.md) — Australian source governance for RAG — Implementation Plan — Goal: Establish a typed, enforceable Australian source catalogue that augments uploaded indexed guidelines, excludes Healthdirect, treats eT…
- [superpowers/plans/2026-08-20-rag-evaluation-rollout.md](superpowers/plans/2026-08-20-rag-evaluation-rollout.md) — RAG programme evaluation, rollout, and operations — Implementation Plan — Goal: Make every source, retrieval, answer, fallback, re-index, and incremental-delivery improvement measurable, privacy-minimised, reversib…
- [superpowers/plans/2026-08-20-rag-ingestion-reindex.md](superpowers/plans/2026-08-20-rag-ingestion-reindex.md) — Governed ingestion audit and reversible targeted re-index — Implementation Plan — Goal: Determine which documents genuinely need repair, acquire only allowlisted public Australian versions into a governed shadow state, cor…
- [superpowers/plans/2026-08-20-rag-retrieval-composition.md](superpowers/plans/2026-08-20-rag-retrieval-composition.md) — RAG query planning, combined retrieval, and fallback — Implementation Plan — Goal: Stop false “not enough information” answers by decomposing only genuinely broad questions, searching shared uploaded guidance, current…
- [superpowers/plans/2026-08-20-rag-verified-incremental-delivery.md](superpowers/plans/2026-08-20-rag-verified-incremental-delivery.md) — Verified incremental RAG delivery — Implementation Plan — Goal: Make the chat begin showing useful answer text sooner, while preserving the rule that no raw token, provisional dose, incomplete JSON,…
- [superpowers/plans/2026-08-21-developer-hub-phase-1-COMPLETION.md](superpowers/plans/2026-08-21-developer-hub-phase-1-COMPLETION.md) — Developer hub Phase 1 — completion record — Companion to -HANDOFF.md (how to resume) and -WORKLOG.md (the full history through Task 2).
- [superpowers/plans/2026-08-21-developer-hub-phase-1-HANDOFF.md](superpowers/plans/2026-08-21-developer-hub-phase-1-HANDOFF.md) — Developer hub Phase 1 — handoff — Read this before touching the plan.
- [superpowers/plans/2026-08-21-developer-hub-phase-1-WORKLOG.md](superpowers/plans/2026-08-21-developer-hub-phase-1-WORKLOG.md) — Developer hub Phase 1 — complete worklog — Everything done on this work, in order, including what failed.
- [superpowers/plans/2026-08-21-developer-hub-phase-1.md](superpowers/plans/2026-08-21-developer-hub-phase-1.md) — Developer hub — Phase 1 implementation plan — Goal: Turn /mockups/development into a login-gated developer hub whose first live panel is a task ledger rendered from docs/outstanding-issu…
- [superpowers/plans/2026-08-21-rag-repository-content-sync.md](superpowers/plans/2026-08-21-rag-repository-content-sync.md) — Repository-wide first-party content retrieval and freshness — Implementation Plan — Goal: Let Answer mode retrieve the relevant approved the product content for questions about specifiers, differentials, medications, service…
- [superpowers/plans/2026-08-21-trusted-admin-document-ingestion.md](superpowers/plans/2026-08-21-trusted-admin-document-ingestion.md) — Trusted Admin/Backend Document Ingestion — Implementation Plan — Goal: Make a trusted administrator/backend upload the clinical-admission event, then automatically activate the document for shared clinical…
- [superpowers/plans/2026-08-22-developer-hub-phase-2-HANDOFF.md](superpowers/plans/2026-08-22-developer-hub-phase-2-HANDOFF.md) — Developer hub Phase 2 — handoff — Companion to the plan (2026-08-22-developer-hub-phase-2.md) and the approved spec (docs/superpowers/specs/2026-08-22-developer-hub-phase-2-d…
- [superpowers/plans/2026-08-22-developer-hub-phase-2.md](superpowers/plans/2026-08-22-developer-hub-phase-2.md) — Developer hub Phase 2 (repo awareness) Implementation Plan — Goal: Fill the developer hub's four phase:
- [superpowers/plans/2026-08-22-mode-aware-clinical-ask-implementation.md](superpowers/plans/2026-08-22-mode-aware-clinical-ask-implementation.md) — Mode-aware Clinical Ask Implementation Plan — Goal: Add an explicit typed-or-dictated Clinical Ask action to Services, Forms, Differentials, Formulation, DSM-5 Diagnosis, Specifiers, and…
- [superpowers/plans/2026-08-23-clinical-trust-cockpit.md](superpowers/plans/2026-08-23-clinical-trust-cockpit.md) — Clinical trust cockpit — implementation plan — Goal: Give authorised reviewers one place to see content maturity, source-change impact, and quality feedback with explicit ownership and ev…
- [superpowers/plans/2026-08-23-favourites-and-reconciliation.md](superpowers/plans/2026-08-23-favourites-and-reconciliation.md) — Favourites and repository reconciliation — implementation plan — Goal: Complete stable-reference favourites and leave the branch/worktree fleet safer without sacrificing recoverable work.
- [superpowers/plans/2026-08-23-lighthouse-local-build-reliability.md](superpowers/plans/2026-08-23-lighthouse-local-build-reliability.md) — Lighthouse Local Build Reliability Implementation Plan — Goal: Let the repository-owned Lighthouse workflow complete its isolated production build on the supported Windows workstation without weake…
- [superpowers/plans/2026-08-23-outstanding-p2-p3-remediation.md](superpowers/plans/2026-08-23-outstanding-p2-p3-remediation.md) — Outstanding P2/P3 Remediation Implementation Plan — Goal: Resolve all 55 supplied P2/P3 ledger rows through permanent repository fixes, evidence-backed closures, or accurate external-gate upda…
- [superpowers/plans/2026-08-23-performance-remediation-current-main.md](superpowers/plans/2026-08-23-performance-remediation-current-main.md) — Current-main Performance Remediation Implementation Plan — Goal: Resolve the performance defects that remain evidenced on current main, strengthen the measurement and budget guardrails that failed to…
- [superpowers/plans/2026-08-23-platform-contracts-readiness.md](superpowers/plans/2026-08-23-platform-contracts-readiness.md) — Platform contracts and readiness — implementation plan — Goal: Make API/model payloads, privacy readiness, alerts, and clinical-hazard evidence machine-checkable without overstating external accept…
- [superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md](superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md) — Caring Contacts Phase 2B — The Working Screens: Implementation Plan — Status: DRAFT, not yet approved for execution.
- [superpowers/plans/2026-08-25-developer-hub-ingestion-panel.md](superpowers/plans/2026-08-25-developer-hub-ingestion-panel.md) — Developer hub — ingestion panel — Date: 2026-08-25 Status:
- [superpowers/plans/2026-08-25-ward-flow-phase-4-specialist-boards.md](superpowers/plans/2026-08-25-ward-flow-phase-4-specialist-boards.md) — Ward Flow Phase 4 — specialist boards, implementation plan — Goal: Build the eleven Phase 4 items — a scarcer scenario, mid-flight urgency and legal-status changes, the undo the prototype has never had…
- [superpowers/plans/2026-08-25-ward-flow-sandbox-and-design-repair.md](superpowers/plans/2026-08-25-ward-flow-sandbox-and-design-repair.md) — Ward Flow — its own sandbox, and the design repair — Goal: Move Ward Flow into its own administrator-gated sandbox, reachable only through the developer page, and repair the navigation, landmar…
- [superpowers/plans/2026-08-25-ward-flow-standalone-and-nav-repair.md](superpowers/plans/2026-08-25-ward-flow-standalone-and-nav-repair.md) — Ward Flow — standalone prototype, and the navigation repair — Goal: Take Ward Flow out of the clinical application entirely — reachable only from the developer hub — and repair the navigation, landmark…
- [superpowers/plans/2026-08-26-ward-flow-phase-5-bed-availability.md](superpowers/plans/2026-08-26-ward-flow-phase-5-bed-availability.md) — Ward Flow Phase 5 — Bed availability becomes real — Goal: wards record when their beds are actually coming free, and the coordinator's capacity figure becomes a number that can be planned agai…
- [superpowers/plans/2026-08-26-ward-flow-sidebar-house-pattern.md](superpowers/plans/2026-08-26-ward-flow-sidebar-house-pattern.md) — Ward Flow sidebar — adopt the repository's house sidebar pattern — Goal: Give Ward Flow the same sidebar _approach and structure_ the clinical application already uses, tailored to Ward Flow's own tokens, st…
- [superpowers/plans/2026-09-01-calculators-clinical-safety.md](superpowers/plans/2026-09-01-calculators-clinical-safety.md) — Calculators clinical safety and governance implementation plan
- [superpowers/plans/2026-09-01-native-smart-catalogue-search.md](superpowers/plans/2026-09-01-native-smart-catalogue-search.md) — Native Smart Catalogue Search Implementation Plan — Goal: Add safe, provider-free natural-language catalogue search to Medication, Tools, Calculators, Factsheets, and Dictionary while preservi…
- [superpowers/plans/2026-09-01-services-safety-provenance.md](superpowers/plans/2026-09-01-services-safety-provenance.md) — Services Safety and Provenance Foundation — Implementation Plan — 2. Add canonical source modules and validation.
- [superpowers/plans/2026-09-01-sources-mode.md](superpowers/plans/2026-09-01-sources-mode.md) — Sources Mode Implementation Plan — Goal: Build a read-only /sources application mode that automatically catalogues, organises, rates, ranks and traces every structured academi…
- [superpowers/plans/2026-09-02-caring-contact-phase-3-demonstrable.md](superpowers/plans/2026-09-02-caring-contact-phase-3-demonstrable.md) — Caring Contacts Phase 3 — Make It Demonstrable: Implementation Plan — Status: DRAFT, not yet approved for execution.
- [superpowers/rag-upgrade/CLOUD-EXECUTION-PROMPT.md](superpowers/rag-upgrade/CLOUD-EXECUTION-PROMPT.md) — Cloud execution prompt template — Use the final handover message's filled prompt, not this unfilled template.
- [superpowers/rag-upgrade/LOCAL-CONNECTED-EXECUTION-PROMPT.md](superpowers/rag-upgrade/LOCAL-CONNECTED-EXECUTION-PROMPT.md) — New-session local connected execution prompt — Use this only after Cloud P17 and accepted PROGRAMME.json are published.
- [superpowers/rag-upgrade/canonical/START-HERE.cloud.md](superpowers/rag-upgrade/canonical/START-HERE.cloud.md) — Cloud execution package — start here — This package executes P00–P17 only.
- [superpowers/rag-upgrade/canonical/START-HERE.local.md](superpowers/rag-upgrade/canonical/START-HERE.local.md) — Local operational package — start here — This is the new-session Windows/local handover for L00–L10 after accepted Cloud P00–P17 work.
- [superpowers/rag-upgrade/canonical/approval-matrix.md](superpowers/rag-upgrade/canonical/approval-matrix.md) — Authority and approval matrix — Authority is action- and target-specific.
- [superpowers/rag-upgrade/canonical/connected-execution.md](superpowers/rag-upgrade/canonical/connected-execution.md) — Local connected execution contract — This contract begins only after P17 and the immutable offline PROGRAMME.json are accepted and published.
- [superpowers/rag-upgrade/canonical/execution-order.md](superpowers/rag-upgrade/canonical/execution-order.md) — RAG upgrade execution order — The manifest is the scheduling authority.
- [superpowers/rag-upgrade/canonical/sdd-execution.md](superpowers/rag-upgrade/canonical/sdd-execution.md) — Subagent-driven execution contract — The tracked .agents/skills/rag-cloud-sdd/SKILL.md is the self-contained Cloud controller.
- [superpowers/rag-upgrade/cloud/START-HERE.md](superpowers/rag-upgrade/cloud/START-HERE.md) — Cloud execution package — start here — This package executes P00–P17 only.
- [superpowers/rag-upgrade/cloud/approval-matrix.md](superpowers/rag-upgrade/cloud/approval-matrix.md) — Authority and approval matrix — Authority is action- and target-specific.
- [superpowers/rag-upgrade/cloud/connected-execution.md](superpowers/rag-upgrade/cloud/connected-execution.md) — Local connected execution contract — This contract begins only after P17 and the immutable offline PROGRAMME.json are accepted and published.
- [superpowers/rag-upgrade/cloud/execution-order.md](superpowers/rag-upgrade/cloud/execution-order.md) — RAG upgrade execution order — The manifest is the scheduling authority.
- [superpowers/rag-upgrade/cloud/plans/2026-08-20-rag-adaptive-answer.md](superpowers/rag-upgrade/cloud/plans/2026-08-20-rag-adaptive-answer.md) — Adaptive RAG answer and display — Implementation Plan — Goal: Extend the landed v19 moderate-length/related-information contract into evidence-gated adaptive answers, and remove the independent si…
- [superpowers/rag-upgrade/cloud/plans/2026-08-20-rag-australian-source-governance.md](superpowers/rag-upgrade/cloud/plans/2026-08-20-rag-australian-source-governance.md) — Australian source governance for RAG — Implementation Plan — Goal: Establish a typed, enforceable Australian source catalogue that augments uploaded indexed guidelines, excludes Healthdirect, treats eT…
- [superpowers/rag-upgrade/cloud/plans/2026-08-20-rag-evaluation-rollout.md](superpowers/rag-upgrade/cloud/plans/2026-08-20-rag-evaluation-rollout.md) — RAG programme evaluation, rollout, and operations — Implementation Plan — Goal: Make every source, retrieval, answer, fallback, re-index, and incremental-delivery improvement measurable, privacy-minimised, reversib…
- [superpowers/rag-upgrade/cloud/plans/2026-08-20-rag-ingestion-reindex.md](superpowers/rag-upgrade/cloud/plans/2026-08-20-rag-ingestion-reindex.md) — Governed ingestion audit and reversible targeted re-index — Implementation Plan — Goal: Determine which documents genuinely need repair, acquire only allowlisted public Australian versions into a governed shadow state, cor…
- [superpowers/rag-upgrade/cloud/plans/2026-08-20-rag-retrieval-composition.md](superpowers/rag-upgrade/cloud/plans/2026-08-20-rag-retrieval-composition.md) — RAG query planning, combined retrieval, and fallback — Implementation Plan — Goal: Stop false “not enough information” answers by decomposing only genuinely broad questions, searching shared uploaded guidance, current…
- [superpowers/rag-upgrade/cloud/plans/2026-08-20-rag-verified-incremental-delivery.md](superpowers/rag-upgrade/cloud/plans/2026-08-20-rag-verified-incremental-delivery.md) — Verified incremental RAG delivery — Implementation Plan — Goal: Make the chat begin showing useful answer text sooner, while preserving the rule that no raw token, provisional dose, incomplete JSON,…
- [superpowers/rag-upgrade/cloud/plans/2026-08-21-rag-repository-content-sync.md](superpowers/rag-upgrade/cloud/plans/2026-08-21-rag-repository-content-sync.md) — Repository-wide first-party content retrieval and freshness — Implementation Plan — Goal: Let Answer mode retrieve the relevant approved the product content for questions about specifiers, differentials, medications, service…
- [superpowers/rag-upgrade/cloud/plans/2026-08-21-trusted-admin-document-ingestion.md](superpowers/rag-upgrade/cloud/plans/2026-08-21-trusted-admin-document-ingestion.md) — Trusted Admin/Backend Document Ingestion — Implementation Plan — Goal: Make a trusted administrator/backend upload the clinical-admission event, then automatically activate the document for shared clinical…
- [superpowers/rag-upgrade/cloud/sdd-execution.md](superpowers/rag-upgrade/cloud/sdd-execution.md) — Subagent-driven execution contract — The tracked .agents/skills/rag-cloud-sdd/SKILL.md is the self-contained Cloud controller.
- [superpowers/rag-upgrade/cloud/specs/2026-08-20-rag-answer-and-australian-sources-design.md](superpowers/rag-upgrade/cloud/specs/2026-08-20-rag-answer-and-australian-sources-design.md) — RAG answer quality, repository content, and Australian source augmentation — design — Status: Approved programme design, reconciled against origin/main aa0c04bce12995894a9287cb1a084f89f2ed6ef8 on 2026-08-22.
- [superpowers/rag-upgrade/cloud/specs/2026-08-21-trusted-admin-document-ingestion-design.md](superpowers/rag-upgrade/cloud/specs/2026-08-21-trusted-admin-document-ingestion-design.md) — Trusted Admin/Backend Document Ingestion and RAG Activation Design — Date: 2026-08-21 Status:
- [superpowers/rag-upgrade/execution-artifacts/rag-answer-quality-and-repository-coverage-v1/README.md](superpowers/rag-upgrade/execution-artifacts/rag-answer-quality-and-repository-coverage-v1/README.md) — RAG upgrade execution artifacts — Accepted phase receipts reference immutable artifacts below this directory.
- [superpowers/rag-upgrade/execution-receipts/rag-answer-quality-and-repository-coverage-v1/README.md](superpowers/rag-upgrade/execution-receipts/rag-answer-quality-and-repository-coverage-v1/README.md) — RAG upgrade execution receipts — This tracked directory is the durable cross-session ledger for programme rag-answer-quality-and-repository-coverage-v1.
- [superpowers/rag-upgrade/local/START-HERE.md](superpowers/rag-upgrade/local/START-HERE.md) — Local operational package — start here — This is the new-session Windows/local handover for L00–L10 after accepted Cloud P00–P17 work.
- [superpowers/rag-upgrade/local/approval-matrix.md](superpowers/rag-upgrade/local/approval-matrix.md) — Authority and approval matrix — Authority is action- and target-specific.
- [superpowers/rag-upgrade/local/connected-execution.md](superpowers/rag-upgrade/local/connected-execution.md) — Local connected execution contract — This contract begins only after P17 and the immutable offline PROGRAMME.json are accepted and published.
- [superpowers/rag-upgrade/local/execution-order.md](superpowers/rag-upgrade/local/execution-order.md) — RAG upgrade execution order — The manifest is the scheduling authority.
- [superpowers/rag-upgrade/local/plans/2026-08-20-rag-adaptive-answer.md](superpowers/rag-upgrade/local/plans/2026-08-20-rag-adaptive-answer.md) — Adaptive RAG answer and display — Implementation Plan — Goal: Extend the landed v19 moderate-length/related-information contract into evidence-gated adaptive answers, and remove the independent si…
- [superpowers/rag-upgrade/local/plans/2026-08-20-rag-australian-source-governance.md](superpowers/rag-upgrade/local/plans/2026-08-20-rag-australian-source-governance.md) — Australian source governance for RAG — Implementation Plan — Goal: Establish a typed, enforceable Australian source catalogue that augments uploaded indexed guidelines, excludes Healthdirect, treats eT…
- [superpowers/rag-upgrade/local/plans/2026-08-20-rag-evaluation-rollout.md](superpowers/rag-upgrade/local/plans/2026-08-20-rag-evaluation-rollout.md) — RAG programme evaluation, rollout, and operations — Implementation Plan — Goal: Make every source, retrieval, answer, fallback, re-index, and incremental-delivery improvement measurable, privacy-minimised, reversib…
- [superpowers/rag-upgrade/local/plans/2026-08-20-rag-ingestion-reindex.md](superpowers/rag-upgrade/local/plans/2026-08-20-rag-ingestion-reindex.md) — Governed ingestion audit and reversible targeted re-index — Implementation Plan — Goal: Determine which documents genuinely need repair, acquire only allowlisted public Australian versions into a governed shadow state, cor…
- [superpowers/rag-upgrade/local/plans/2026-08-20-rag-retrieval-composition.md](superpowers/rag-upgrade/local/plans/2026-08-20-rag-retrieval-composition.md) — RAG query planning, combined retrieval, and fallback — Implementation Plan — Goal: Stop false “not enough information” answers by decomposing only genuinely broad questions, searching shared uploaded guidance, current…
- [superpowers/rag-upgrade/local/plans/2026-08-20-rag-verified-incremental-delivery.md](superpowers/rag-upgrade/local/plans/2026-08-20-rag-verified-incremental-delivery.md) — Verified incremental RAG delivery — Implementation Plan — Goal: Make the chat begin showing useful answer text sooner, while preserving the rule that no raw token, provisional dose, incomplete JSON,…
- [superpowers/rag-upgrade/local/plans/2026-08-21-rag-repository-content-sync.md](superpowers/rag-upgrade/local/plans/2026-08-21-rag-repository-content-sync.md) — Repository-wide first-party content retrieval and freshness — Implementation Plan — Goal: Let Answer mode retrieve the relevant approved the product content for questions about specifiers, differentials, medications, service…
- [superpowers/rag-upgrade/local/plans/2026-08-21-trusted-admin-document-ingestion.md](superpowers/rag-upgrade/local/plans/2026-08-21-trusted-admin-document-ingestion.md) — Trusted Admin/Backend Document Ingestion — Implementation Plan — Goal: Make a trusted administrator/backend upload the clinical-admission event, then automatically activate the document for shared clinical…
- [superpowers/rag-upgrade/local/sdd-execution.md](superpowers/rag-upgrade/local/sdd-execution.md) — Subagent-driven execution contract — The tracked .agents/skills/rag-cloud-sdd/SKILL.md is the self-contained Cloud controller.
- [superpowers/rag-upgrade/local/specs/2026-08-20-rag-answer-and-australian-sources-design.md](superpowers/rag-upgrade/local/specs/2026-08-20-rag-answer-and-australian-sources-design.md) — RAG answer quality, repository content, and Australian source augmentation — design — Status: Approved programme design, reconciled against origin/main aa0c04bce12995894a9287cb1a084f89f2ed6ef8 on 2026-08-22.
- [superpowers/rag-upgrade/local/specs/2026-08-21-trusted-admin-document-ingestion-design.md](superpowers/rag-upgrade/local/specs/2026-08-21-trusted-admin-document-ingestion-design.md) — Trusted Admin/Backend Document Ingestion and RAG Activation Design — Date: 2026-08-21 Status:
- [superpowers/specs/2026-07-02-triage-security-reliability-design.md](superpowers/specs/2026-07-02-triage-security-reliability-design.md) — Triage Security & Reliability Fixes Design — Date: 2026-07-02 Scope:
- [superpowers/specs/2026-08-05-editable-pin-menu-mockups-design.md](superpowers/specs/2026-08-05-editable-pin-menu-mockups-design.md) — Search + Editable Pins Menu — Final Mockup Direction — Route: /mockups/search-lens-menu…
- [superpowers/specs/2026-08-14-ward-management-design.md](superpowers/specs/2026-08-14-ward-management-design.md) — Ward Management — Statewide Mental Health Patient Flow Design — Status: Approved design direction;
- [superpowers/specs/2026-08-15-caring-contact-coordination-design.md](superpowers/specs/2026-08-15-caring-contact-coordination-design.md) — Caring Contact Coordination Workspace — binding design specification — Status: synthetic design prototype only, 15 August 2026 Decision source:
- [superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md](superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md) — Ward Flow — metro psychiatry patient flow, design — Status: Approved design, awaiting implementation plan.
- [superpowers/specs/2026-08-19-caring-contact-production-build-design.md](superpowers/specs/2026-08-19-caring-contact-production-build-design.md) — Caring Contact production build — binding design specification — Status: synthetic production build, approved 19 August 2026.
- [superpowers/specs/2026-08-19-ward-flow-phase-3-role-screens-design.md](superpowers/specs/2026-08-19-ward-flow-phase-3-role-screens-design.md) — Ward Flow Phase 3 — the other three roles — Design — Status: approved in brainstorming 2026-08-19.
- [superpowers/specs/2026-08-20-rag-answer-and-australian-sources-design.md](superpowers/specs/2026-08-20-rag-answer-and-australian-sources-design.md) — RAG answer quality, repository content, and Australian source augmentation — design — Status: Approved programme design, reconciled against origin/main aa0c04bce12995894a9287cb1a084f89f2ed6ef8 on 2026-08-22.
- [superpowers/specs/2026-08-21-developer-hub-phase-1-design.md](superpowers/specs/2026-08-21-developer-hub-phase-1-design.md) — Developer hub — Phase 1 design (hub shell, environment strip, task ledger) — Date: 2026-08-21 Status:
- [superpowers/specs/2026-08-21-mode-aware-clinical-ask-design.md](superpowers/specs/2026-08-21-mode-aware-clinical-ask-design.md) — Mode-aware Clinical Ask — binding design specification — Status: approved 21 August 2026;
- [superpowers/specs/2026-08-21-trusted-admin-document-ingestion-design.md](superpowers/specs/2026-08-21-trusted-admin-document-ingestion-design.md) — Trusted Admin/Backend Document Ingestion and RAG Activation Design — Date: 2026-08-21 Status:
- [superpowers/specs/2026-08-22-developer-hub-phase-2-design.md](superpowers/specs/2026-08-22-developer-hub-phase-2-design.md) — Developer hub — Phase 2 design (repo awareness) — Date: 2026-08-22 Status:
- [superpowers/specs/2026-08-23-clinical-operations-programme-design.md](superpowers/specs/2026-08-23-clinical-operations-programme-design.md) — Clinical operations programme — design — Status: autonomous implementation direction Date:
- [superpowers/specs/2026-08-23-outstanding-p2-p3-remediation-design.md](superpowers/specs/2026-08-23-outstanding-p2-p3-remediation-design.md) — Outstanding P2/P3 Remediation Programme Design — Date: 2026-08-23…
- [superpowers/specs/2026-08-25-ward-flow-phase-4-specialist-boards-design.md](superpowers/specs/2026-08-25-ward-flow-phase-4-specialist-boards-design.md) — Ward Flow Phase 4 — specialist boards, design — Date: 2026-08-25. Product owner:
- [superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md](superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md) — Ward Flow Phase 5 — Bed availability becomes real — Status: design, approved in chat 2026-08-26.
- [superpowers/specs/2026-09-01-calculators-clinical-safety.md](superpowers/specs/2026-09-01-calculators-clinical-safety.md) — Calculators clinical safety and evidence-governance specification — Date: 1 September 2026 Repository:
- [superpowers/specs/2026-09-01-native-smart-catalogue-search-design.md](superpowers/specs/2026-09-01-native-smart-catalogue-search-design.md) — Native Smart Catalogue Search Design — Date: 2026-09-01…
- [superpowers/specs/2026-09-01-services-safety-provenance-design.md](superpowers/specs/2026-09-01-services-safety-provenance-design.md) — Services Safety and Provenance Foundation — Design — Date: 2026-09-01 Repository base:
- [superpowers/specs/2026-09-01-sources-mode-design.md](superpowers/specs/2026-09-01-sources-mode-design.md) — Sources Mode and Clinical Source Catalogue Design — Status: Approved design, written 2026-09-01 against 058693b97.
- [ward-flow-phase-3-workspace/README.md](ward-flow-phase-3-workspace/README.md) — Ward Flow Phase 3 — subagent-driven-development workspace (durable copy) — This directory is a committed copy of the live superpowers workspace at .superpowers/sdd/2026-08-19-ward-flow-phase-3-role-screens/, taken 2…
- [ward-flow-phase-3-workspace/clinical-changes-report.md](ward-flow-phase-3-workspace/clinical-changes-report.md) — Clinical changes report — ED access target to 24h, and "Bed need confirmed" priority factor — Both changes came directly from the product owner (a practising psychiatrist), answering a direct question on 2026-08-22:
- [ward-flow-phase-3-workspace/concurrent-session-inventory.md](ward-flow-phase-3-workspace/concurrent-session-inventory.md) — Concurrent session inventory — ward-management-design worktree — Read-only diagnostic.
- [ward-flow-phase-3-workspace/flow-diagram-fix-brief.md](ward-flow-phase-3-workspace/flow-diagram-fix-brief.md) — Flow-diagram restriction-notice fix — brief — Standalone fix, split out of Task 8 at the user's request.
- [ward-flow-phase-3-workspace/flow-diagram-fix-report.md](ward-flow-phase-3-workspace/flow-diagram-fix-report.md) — Flow-diagram restriction-notice fix — report — Worked at C:\Users\joshs\.codex\worktrees\ward-management-design\Database, branch codex/ward-management-design, starting HEAD 3b4bf4152.
- [ward-flow-phase-3-workspace/handover-stage-coherence-report.md](ward-flow-phase-3-workspace/handover-stage-coherence-report.md) — Ruling R64 — handover-ready stage coherence fix — Five patients were recorded at handover_ready in a state the reducer's own rules make unreachable:
- [ward-flow-phase-3-workspace/preflight-tasks-9-to-12.md](ward-flow-phase-3-workspace/preflight-tasks-9-to-12.md) — Pre-flight scan of Tasks 9 to 12 — session 3, measured against the branch at a75c508f6 — Every number below was produced by running the real fixture and the real derivations, not by reading the code and reasoning.
- [ward-flow-phase-3-workspace/progress.md](ward-flow-phase-3-workspace/progress.md) — SDD ledger — plan: docs/superpowers/plans/2026-08-19-ward-flow-phase-3-role-screens.md — Spec: docs/superpowers/specs/2026-08-19-ward-flow-phase-3-role-screens-design.md (reachable, 19 sections) Worktree:
- [ward-flow-phase-3-workspace/task-1-brief.md](ward-flow-phase-3-workspace/task-1-brief.md) — task-1-brief
- [ward-flow-phase-3-workspace/task-1-report.md](ward-flow-phase-3-workspace/task-1-report.md) — Task 1 report — The model and the fixture — Branch: codex/ward-management-design Worktree:
- [ward-flow-phase-3-workspace/task-1-review.md](ward-flow-phase-3-workspace/task-1-review.md) — Task 1 review — the model and the fixture — Reviewed range: fbd9a8628..39042cd61 (commits f3b1f74f0, 39042cd61).
- [ward-flow-phase-3-workspace/task-10-brief.md](ward-flow-phase-3-workspace/task-10-brief.md) — task-10-brief
- [ward-flow-phase-3-workspace/task-10-report.md](ward-flow-phase-3-workspace/task-10-report.md) — Task 10 report — the coordinator's live tracker — Commit: b2e0a92aa on codex/ward-management-design.
- [ward-flow-phase-3-workspace/task-11-brief.md](ward-flow-phase-3-workspace/task-11-brief.md) — task-11-brief
- [ward-flow-phase-3-workspace/task-11-report.md](ward-flow-phase-3-workspace/task-11-report.md) — Task 11 report — the emergency department screen — Branch codex/ward-management-design, committed at 66c4f7b80 (parent dc5daffa0, itself on top of b2e0a92aa).
- [ward-flow-phase-3-workspace/task-12-addendum.md](ward-flow-phase-3-workspace/task-12-addendum.md) — Task 12 — controller addendum (read this WITH the brief; where they differ, this wins) — Task 12 is the last task and the one that proves the phase.
- [ward-flow-phase-3-workspace/task-12-brief.md](ward-flow-phase-3-workspace/task-12-brief.md) — task-12-brief
- [ward-flow-phase-3-workspace/task-12-journey-design.md](ward-flow-phase-3-workspace/task-12-journey-design.md) — Task 12 journey — defect verification and corrected design — Offline analysis only.
- [ward-flow-phase-3-workspace/task-2-brief.md](ward-flow-phase-3-workspace/task-2-brief.md) — task-2-brief
- [ward-flow-phase-3-workspace/task-2-report.md](ward-flow-phase-3-workspace/task-2-report.md) — Task 2 report: the reducer — ReferralDraft, the WardFlowEvent discriminated union (15 variants, one per spec §6 row), and EVENT_ROLE:
- [ward-flow-phase-3-workspace/task-2-review.md](ward-flow-phase-3-workspace/task-2-review.md) — Task 2 review: the reducer — difference is the brief's leading // tests/ward-flow-reducer.test.ts comment line, not present in the committed file).
- [ward-flow-phase-3-workspace/task-3-brief.md](ward-flow-phase-3-workspace/task-3-brief.md) — task-3-brief
- [ward-flow-phase-3-workspace/task-3-report.md](ward-flow-phase-3-workspace/task-3-report.md) — Task 3 report — Ward Flow Phase 3: the contracts — One file created, verbatim from the brief:
- [ward-flow-phase-3-workspace/task-3-review.md](ward-flow-phase-3-workspace/task-3-review.md) — Task 3 review — the contracts (WF-001 fix round) — Reviewed: e7faa7b5a..cbdd47f71 (two commits), file under review tests/ward-flow-contracts.test.ts.
- [ward-flow-phase-3-workspace/task-4-brief.md](ward-flow-phase-3-workspace/task-4-brief.md) — task-4-brief
- [ward-flow-phase-3-workspace/task-4-report.md](ward-flow-phase-3-workspace/task-4-report.md) — Task 4 report: the provider, the clock and the layout — the lazy third-arg form, so the fixture is deep-cloned exactly once at mount, never re-seeded on a later render.
- [ward-flow-phase-3-workspace/task-4-review.md](ward-flow-phase-3-workspace/task-4-review.md) — Task 4 review: the provider, the clock and the layout — NOW_ANCHOR), the useReducer(wardFlowReducer, undefined, seedWardFlowState) lazy-seed form, the clock's pin/tick contract, useWardFlow's cons…
- [ward-flow-phase-3-workspace/task-5-brief.md](ward-flow-phase-3-workspace/task-5-brief.md) — task-5-brief
- [ward-flow-phase-3-workspace/task-5-report.md](ward-flow-phase-3-workspace/task-5-report.md) — Task 5 report: the coordinator rewire — imports. Added useWardFlow() and destructured { movements, rejections, now, dispatch }.
- [ward-flow-phase-3-workspace/task-5-review.md](ward-flow-phase-3-workspace/task-5-review.md) — Task 5 review: the coordinator rewire — dispatch, cap-at-3 multi-select, restrictionNotice with the verbatim strings, refusals section present-when-empty) is implemented as specifi…
- [ward-flow-phase-3-workspace/task-6-brief.md](ward-flow-phase-3-workspace/task-6-brief.md) — task-6-brief
- [ward-flow-phase-3-workspace/task-6-fix-round-3-findings.md](ward-flow-phase-3-workspace/task-6-fix-round-3-findings.md) — Task 6 — fix round 3 findings (the last round for this task) — Two findings from the Task 6 review.
- [ward-flow-phase-3-workspace/task-6-re-review-rounds-3-4.md](ward-flow-phase-3-workspace/task-6-re-review-rounds-3-4.md) — Task 6 — Scoped re-review of fix rounds 3 and 4 — Reviewed at 845b7d456 (worktree C:\Users\joshs\.codex\worktrees\ward-management-design\Database, branch codex/ward-management-design, tree c…
- [ward-flow-phase-3-workspace/task-6-report.md](ward-flow-phase-3-workspace/task-6-report.md) — Task 6 report: the other ten routes — Branch codex/ward-management-design, base commit 868853b58.
- [ward-flow-phase-3-workspace/task-6-review.md](ward-flow-phase-3-workspace/task-6-review.md) — Task 6 review: the other ten routes — Reviewed diff 868853b58..18f57736f (3 commits) against task-6-brief.md and task-6-report.md.
- [ward-flow-phase-3-workspace/task-6a-brief.md](ward-flow-phase-3-workspace/task-6a-brief.md) — Task 6A — the post-examination clock counts up, and no deadline is claimed — Inserted between Task 6 and Task 7 by controller rulings F15–F17, in response to the clinician answering the phase's standing open question.
- [ward-flow-phase-3-workspace/task-6a-re-review.md](ward-flow-phase-3-workspace/task-6a-re-review.md) — Task 6A fix round 1 — scoped re-review — Reviewer session. Read-only re-review of commit f1e32dcd473eb435e5e952e7896fa4060e9be332 on branch codex/ward-management-design, worktree C:…
- [ward-flow-phase-3-workspace/task-6a-report.md](ward-flow-phase-3-workspace/task-6a-report.md) — Task 6A report — the post-examination clock counts up, and no deadline is claimed — Implementer session. Branch codex/ward-management-design, worked entirely in C:\Users\joshs\.codex\worktrees\ward-management-design\Database.
- [ward-flow-phase-3-workspace/task-6a-review.md](ward-flow-phase-3-workspace/task-6a-review.md) — Task 6A review — the post-examination clock counts up, and no deadline is claimed — Reviewer session. Read-only review of commit 2d8200a09b124ef61ee5692c812306bf5dd6c6fa on branch codex/ward-management-design, worktree C:\Us…
- [ward-flow-phase-3-workspace/task-7-addendum.md](ward-flow-phase-3-workspace/task-7-addendum.md) — Task 7 — controller addendum (read this WITH the brief; where they differ, this wins) — Four corrections found in a pre-flight scan of task-7-brief.md against the branch as it stands at Task 6A.
- [ward-flow-phase-3-workspace/task-7-brief.md](ward-flow-phase-3-workspace/task-7-brief.md) — task-7-brief
- [ward-flow-phase-3-workspace/task-7-report.md](ward-flow-phase-3-workspace/task-7-report.md) — Task 7 report — the coordinator's phone pins Confirm — coordinator-screen.tsx's nested double-requestAnimationFrame scrollIntoView effect (and the shortlistColumnRef it depended on) is deleted.
- [ward-flow-phase-3-workspace/task-8-addendum.md](ward-flow-phase-3-workspace/task-8-addendum.md) — Task 8 — controller addendum (read this WITH the brief; where they differ, this wins) — Written in session 3 after scanning task-8-brief.md against the branch as it stands at a75c508f6.
- [ward-flow-phase-3-workspace/task-8-brief.md](ward-flow-phase-3-workspace/task-8-brief.md) — task-8-brief
- [ward-flow-phase-3-workspace/task-8-report.md](ward-flow-phase-3-workspace/task-8-report.md) — Task 8 report — the ward screen — unit's own view, resolved via unitById(unitId).
- [ward-flow-phase-3-workspace/task-9-brief.md](ward-flow-phase-3-workspace/task-9-brief.md) — task-9-brief
- [ward-flow-phase-3-workspace/task-9-report.md](ward-flow-phase-3-workspace/task-9-report.md) — Task 9 report — the transport officer's phone — Worktree: C:\Users\joshs\.codex\worktrees\ward-management-design\Database, branch codex/ward-management-design.
- [ward-flow-phase-3-workspace/transport-leg-helper-report.md](ward-flow-phase-3-workspace/transport-leg-helper-report.md) — Transport leg helper — report — Scope: add one small pure function separating the discrete transport leg from transportStatusLabel's provider narrative, plus unit tests.
- [ward-flow-phase-3-workspace/transport-stage-coherence-report.md](ward-flow-phase-3-workspace/transport-stage-coherence-report.md) — Transport stage/stamp coherence fix — report — Commit: 1349c213fa6f3294a6a8fc22b0aded8c186e8429 Branch:
- [ward-flow-phase-3-workspace/whole-branch-review.md](ward-flow-phase-3-workspace/whole-branch-review.md) — Ward Flow Phase 3 — whole-branch review — Reviewer: independent whole-branch pass at 916816089, branch codex/ward-management-design.

## Archive

- [archive/](archive/) — completed phase plans, superseded designs, and old
  progress logs kept for provenance. Never treat archive content as current
  guidance.

## Maintenance rules

- Generated files (`site-map.md`) are updated only via their generator scripts.
- When adding a doc, add it to the matching section here; date the filename if
  it is a point-in-time record.
- When a maintained doc is superseded, move it to `archive/` and update inbound
  links (`npm run docs:check-links` finds broken ones).
