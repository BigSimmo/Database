# RAG behaviour memory

Durable, evidence-backed knowledge about how this repo's retrieval/ranking stack actually
behaves — created 2026-07-20 after a full measure → tune → structural-fix → refute cycle
(ADDENDUM 4; canary runs #49–#56). Read this BEFORE touching any retrieval, ranking,
selection, release-ordering, or eval-ground-truth surface.

| File                    | What it holds                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `behaviour-map.md`      | The verified mechanics: score imputation sites, the release comparator chains, the gate/threshold ladder, second-stage engagement rules, and which live cases exercise which path. |
| `refuted-approaches.md` | The two live-refuted improvement attempts with their numbers, the root-cause post-mortems, and the binding constraints any third attempt must satisfy.                             |
| `safeguards.md`         | The protection stack: protected-surface list, the pr-policy `RAG impact:` gate, the source-pin contract test, the canary-pair protocol, and the regeneration procedures.           |

Standing rules (mirrored in `AGENTS.md` so every agent session inherits them):

1. **Flag RAG impact.** Any task touching a protected surface (list in `safeguards.md`) must say
   so explicitly before editing, and its PR must carry a `RAG impact:` line (enforced by
   `scripts/pr-policy.mjs` — the check fails without it).
2. **Canary for behaviour changes.** Any retrieval/ranking/ordering behaviour change requires a
   live eval-canary pair — baseline + post — with doc/content recall pinned at 1.0 and zero
   per-case regressions, before the change is trusted. `workflow_dispatch` on
   `eval-canary.yml` (provider-backed → explicit user approval per run).
3. **Offline green is necessary, never sufficient.** The Phase C regression passed 121/121
   offline tests and an adversarial code review, then failed 3/36 live within one run. The live
   corpus is the only authority on ordering behaviour.
4. **Ties are load-bearing.** Pools of equal scores are resolved by the boost/title/subject-aware
   relevance rank — that resolution is correct behaviour, not noise. Never insert a new
   comparator key above the relevance score.

Related: `docs/observability-slos.md` §3.1 (boundary-case & metric-interpretation policy),
`docs/branch-review-ledger.md` (2026-07-20 rows = the full audit trail),
`docs/rag-hybrid-findings-and-todo.md` (older findings; RC-numbered history).
