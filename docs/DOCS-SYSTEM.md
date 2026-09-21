# Documentation system

How Documentation keeps project docs accurate, logged, and non-stale across Joshua’s repos. **Process doc — no product DDL.**

_Owned by Documentation. Updated 2026-09-21._

## Principles

1. **One live source per topic** — archive or stub duplicates.
2. **Stamp what you touch** — live docs carry `_Updated YYYY-MM-DD — <why>; Documentation owns._`
3. **Names only for secrets** — never paste values, JWTs, or dashboard passwords.
4. **Status in one board** — closeout/coordination files own deferred status; other docs link, don’t fork.
5. **Improve the map while you’re here** — one small discoverability/archive/link fix per pass when cheap.
6. **Ward Flow tip lock** — Ward Flow work uses only `D:\Worktrees\Database\ward-lead` on Josh’s PC. Confirm tip (`git log -1` / `rev-parse`) before acting. No stale worktrees, detached inventory/suite checkouts, older SHAs, or cloud agents unless Joshua explicitly names another path.

## Pipeline (every docs change)

```
Scope → Read tip → Edit (class-aware) → Stamp + PR → Memory/FYI → One map improvement
```

| Step | Do |
| --- | --- |
| Scope | Project + tip path/branch; list files; no drive-by WIP |
| Read | Entry doc + any closeout/board; hunt duplicates |
| Edit | Prefer short appends; fix relative links; scrub `file://` |
| Ship | `docs:` commit on `docs/*` branch; PR with Summary + Test plan |
| Log | Agent memory (path, PR, ownership, TBDs); FYI sibling agents only if they own adjacent work |
| Improve | One Start-here / archive / link / port-env fix if cheap |

## Doc classes

| Class | Rule |
| --- | --- |
| Entry (README, first-run) | Short, current, linked from root / `docs/README` |
| Runbook | Imperative; restamp when operator state changes |
| Closeout / deferred | Short; deferred list + status; no secrets |
| Plan / playbook | Don’t duplicate live status — point at the board |
| Historical | Under `archive/` (+ stub if old path is linked) |
| Generated | Don’t hand-edit |

## Freshness

- **Weekday sweep (Documentation routine):** tip identity → entry docs → stamps vs known operator moves → dual ledgers → archive hygiene → link check → open `docs/*` PRs vs teammate updates.
- Fix cheap issues in-sweep; queue large rewrites.
- Stay quiet to Joshua unless something changed or a decision is needed.

## Project registry

| Project | Tip / repo | Entry docs | Doc check | Notes |
| --- | --- | --- | --- | --- |
| Clinical KB / Database | `BigSimmo/Database` (default `main`); local tip often Josh PC worktrees | `README.md`, `docs/README.md`, `docs/supabase-remediation-closeout-notes.md` | Prefer project npm doc-link scripts when present | Supabase closeout: PR #2959 branch `docs/supabase-remediation-closeout-notes` |
| Ward Flow | **Only** Josh PC `D:\Worktrees\Database\ward-lead` (confirm tip before acting; path-stable port helper, often 3605) | `docs/ward-flow/` Start-here / LOCAL-FIRST-RUN / ARCHIVE-NOTE | `npm run ward:check-docs` / link helpers when available | Dated notes under `docs/ward-flow/archive/dated-notes/`; never stale worktrees / cloud / other paths unless Joshua names them |

Extend this table when a new product tip is confirmed — don’t invent paths.

## Related

- Agent skills (Documentation bot): **Documentation Operating System**, **Docs Freshness Audit**.
- Active Clinical KB closeout: [`supabase-remediation-closeout-notes.md`](supabase-remediation-closeout-notes.md).
