# Audit remediation programme — handover (2026-09-02, session wound down early at the owner's request)

Source audit: `docs/audit/full-repository-audit-2026-09-02.md` (PR #2573, merged). Owner decision: fix **all** 162 findings.
Programme design: 21 work packages, one branch each (`claude/audit-fix-<pkg>`), files owned by exactly one package,
each implemented test-first by one agent and adversarially reviewed by a second before the full local gate
(`npm run verify:pr-local`), then a draft PR. Ledger housekeeping (P12) lands last. The database package (P16) is
prepare-only: **never merge it outside an approved window** (merging a migration reaches the live clinical database
within seconds).

Everything below this line is the state at wind-down. All branches listed are pushed to `origin`.
Branches marked **WIP** carry a final commit `wip: checkpoint of unfinished agent work` — unreviewed, ungated,
possibly mid-edit; inspect before building on it. Nothing was force-pushed; no auto-merge was set anywhere.

## Package status

| Pkg | Branch | Commits ahead of main | Review | Gate (`verify:pr-local`) | PR | Notes / next step |
| --- | --- | --- | --- | --- | --- | --- |
| P1 Medication reference correctness (H1, H2, M22) | `claude/audit-fix-p1` | 3 | pass | **passed** (log in this folder) | **#2580 draft** — https://github.com/BigSimmo/Database/pull/2580 | Ready to review/merge. Four owner decisions listed in the PR body. |
| P2 Clinical text/table rendering (H3, L19, M1, M9, M8, L111, L64; L109 moved to P18) | `claude/audit-fix-p2` | 7 | pass | started, **interrupted** (RAG offline evals included in its plan) | none yet | Re-run gate, then open PR with `RAG impact: no retrieval behaviour change — text rendering, table cleaning and citation caveats only`. |
| P3 Session/patient-context privacy (M4, M10, L2, L6, L1, L8) | `claude/audit-fix-p3` | 8 (last is WIP) | **blocked** after round 2 | not run | none | Reviewer found the sign-in clear also fires on the auth library's boot-time SIGNED_IN replay (wipes plan draft / profile / favourites on page reload). Required change is in `results/p3.json` (`review2.blocking`): gate the clear behind an `initialSessionPublishedRef`, add a boot-replay test. The WIP commit is the third-round agent's partial work. |
| P4 Dormant Clinical Ask (M16, L33, L16, L17, M34; L124 moved to P17) | `claude/audit-fix-p4` | 6 | pass (after 1 fix round) | not run | none | Run gate, open PR. Owner decision: whether the round-2 combined commit (L33+M16) should be split. |
| P5 Developer hub & admin routes (14 findings) | `claude/audit-fix-p5` | 12 | pass | not run | none | Run gate, open PR. Residual comment drift routed to P15. |
| P6 Caring Contacts surface (M13, L113, L50, L74) | `claude/audit-fix-p6` | 5 | pass | not run | none | Run gate, open PR. Owner decision: hide the card entirely (done) vs "demonstration only" card. |
| P7 Scripts, test safety, ledger tooling | `claude/audit-fix-p7` | 11 | **unknown** (workflow stopped mid-run; implementer had committed) | not run | none | Read `git log origin/main..claude/audit-fix-p7`; run an adversarial review, then gate. |
| P8a CI workflows & supply chain (incl. browserslist update) | `claude/audit-fix-p8a` | 13 | unknown (stopped) | not run | none | Same as P7. Check `npm audit --omit=dev --audit-level=high` is clean on the branch. |
| P8b Local gates & orphaned tests (M24, M30, M33, L22, L47 partial, M31, M32) | `claude/audit-fix-p8b` | 7 | pass | not run | none | Run gate (includes check:gate-manifest, check:verification-plan, check:ci-scope, check:playwright-pr-shards). Owner decisions: owner-scope widening allowlist (#J43Z6B), hazard register expiry 2026-11-23, verify:cheap counts (routed to P18). |
| P9 Agent tooling & permissions | `claude/audit-fix-p9` | 7 | unknown (stopped) | not run | none | Review, gate, PR. |
| P10 Privacy & governance documents | `claude/audit-fix-p10` | 6 | unknown (stopped) | not run | none | Review, gate, PR (governance preflight required). |
| P11 Documentation drift sweep (full catalogue) | `claude/audit-fix-p11` | 14 | unknown (stopped) | not run | none | Review, gate (docs:check-links, docs:check-index, sitemap:check), PR. |
| P13 Sandboxes & UI tidy-ups | `claude/audit-fix-p13` | 6 | unknown (stopped) | not run | none | Review, gate, PR. |
| P14 Worker, ingestion & caches | `claude/audit-fix-p14` | 1 | not reviewed (stopped early) | not run | none | Mostly unstarted; one commit landed. Resume the implementer. |
| P15 Edge/API hardening (+ P5's comment residuals) | `claude/audit-fix-p15` | 1 (WIP) | none | not run | none | Barely started; WIP checkpoint only. Resume from scratch is fine. |
| P16 Database — prepare only (M12, M23, L25, L73) | `claude/audit-fix-p16` | 7 (last is WIP) | **blocked** after round 1 | not run | none | Blockers: (1) `supabase/drift-manifest.json` stale vs edited `schema.sql` → run `npm run drift:manifest` on a Docker machine and commit; (2) the "bounded synchronous update" safeguard in the M12 migration was inert → make it real; (3) L25 needs `tests/caring-contacts-migrations.test.ts` widened. The WIP commit is the second-round agent's partial work. **Draft only, merge in an approved window.** |
| P17 Dead-code triage (protocol-bound) | `claude/audit-fix-p17` | 1 (WIP) | none | not run | none | Barely started. Must obey `check:dead-code-candidate` refusals. |
| P18 Design decisions (M3, L53, L52/L56, L95, L46, L109, M31-readme, M30-counts, M4-settings-clear, L8-docs) | `claude/audit-fix-p18` | 1 (WIP) | none | not run | none | Barely started. Depends on P2/P3/P8b commits (read their branches first). |
| P19 Security design items (L27, L42, L23, L68, L41) | `claude/audit-fix-p19` | 0 | not started | — | none | Start after P15 lands (possible `src/proxy.ts` overlap). |
| P20 Data, types & dependencies (L45, L49, L118, L131) | `claude/audit-fix-p20` | 0 | not started (stopped at launch) | — | none | Registry calls approved by the owner. |
| P21 Clinical governance drafts (M6, L4) | `claude/audit-fix-p21` | 0 | not started (stopped at launch) | — | none | Produces DRAFT hazard log and message-review pack for clinical sign-off. |
| P12 Ledger housekeeping | not created | — | — | — | — | Lands last, after code PRs merge: `issues:add` for §16 rows, `issues:done/update` for stale rows (inbox checked first), `ledger:append` per merged PR, both snapshots regenerated. |

Also merged earlier today: the audit itself (#2573) and its ledger record (#2576).

## How to resume in a new chat

1. `git fetch origin` and read this folder (`docs/audit/remediation-2026-09-02/` on branch `claude/audit-remediation-handover`):
   `packages.json` (every package's findings, owned files, gate and notes), `results/*.json` (implementer and reviewer
   outputs, including the exact blocking items), `findings/*.md` (the audit text per finding), `remediate.js` (the
   Workflow script: implementer → adversarial reviewer → one fix round), `gate-package.sh` and `pr-body.mjs`.
2. Worktrees: create one per branch (`git worktree add /path/<pkg> claude/audit-fix-<pkg>`; link or install
   `node_modules`). This container's worktrees are gone with the session.
3. For each branch with commits: review (or re-review) → `npm run format` and commit → `npm run verify:pr-local`
   (serial; ~15 min each) → push → draft PR with the repository template (Summary, Verification with decisive lines,
   Risk and rollout, `RAG impact:` line where the package says so, Clinical Governance Preflight for clinical-risk
   packages). Body generator: `node pr-body.mjs <pkg>` after saving the gate log as `logs/<pkg>-gate.log`.
4. Merge order is free except: P16 only inside an approved window; P12 last. After each merge, `git merge origin/main`
   into the remaining branches (never rebase) and regenerate generated files with the tooling if they conflict.
5. Owner decisions collected so far are in each `results/<pkg>.json` under `needs_owner_decision` and in PR #2580's body.

## Rules that shaped every package (do not relax)

RAG ranking/ordering/selection untouched (`RAG impact:` line required where a RAG-adjacent file changes); ledgers and
inbox never hand-edited; no test skipped/deleted/quarantined; no export deleted without `check:dead-code-candidate`;
gate-manifest counts move with any added gate; `diff-integrity` floors never raised; no force pushes; migrations deploy
on merge; one owner per file across open remediation PRs.
