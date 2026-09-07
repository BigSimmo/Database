# Session handover — staging shutdown safety, and an off-ledger repository review

Written 2026-09-06, on branch `claude/staging-db-shutdown-safety-aoabrp`.

**Status:** advisory only. No code changed, no gate ran, no provider was contacted in the
session that produced this document. Every claim below is a repository read, and each one
names the file it came from so the next reader can re-check it rather than trust it.

Two questions were asked and answered:

1. Is it safe to shut down the staging Supabase project, and can schema drift still be
   fixed without it?
2. Excluding the task ledger (`docs/outstanding-issues.md`), what else in this repository
   deserves attention?

---

## 1. Staging Supabase shutdown, and whether drift work depends on it

**Answer: drift detection and drift repair do not touch staging at all. Shutting staging
down does not block either one.**

### What was verified

- **Staging is a separate Supabase project, not a branch of production.** Production is
  `Clinical KB Database` (`sjrfecxgysukkwxsowpy`); staging is `Clinical KB Staging`
  (`ikoiolksxqxfxgiyqpnu`), ap-southeast-2, provisioned 2026-07-19. Source:
  [`staging-setup.md`](staging-setup.md) and
  [`deployment-architecture.md`](deployment-architecture.md) section 5. The two share no
  compute, no pooling and no keys, which is the whole reason staging was built as a
  project rather than a preview branch.
- **The drift gate is production-only.** `check:drift` compares the live production schema
  against `supabase/schema.sql`, and `check:migration-history` compares production's
  recorded migration versions against the files in `supabase/migrations`. Both run in
  `.github/workflows/live-drift.yml` against production. Source:
  [`database-drift-detection.md`](database-drift-detection.md).
- **The pre-merge replay is emulator-only.** CI's `db-reset-verify` job replays the whole
  migration chain in a local Supabase emulator container, and chain-vs-mirror parity
  compares that emulator against the regenerated manifest. Neither step reaches staging or
  production. Source: [`database-drift-detection.md`](database-drift-detection.md),
  "Chain-vs-mirror parity".
- **So the full fix path for drift stays available with staging off:** detect on
  production, author the guard migration, prove it on the emulator in CI, merge inside an
  approved window, then confirm with the post-merge `live-drift` run.

### What is actually lost if staging goes away

- **Migration rehearsal.** Staging exists partly to absorb migration rehearsal and
  destructive experiments before production sees them
  ([`deployment-architecture.md`](deployment-architecture.md) section 5). Losing it does
  not block a drift fix, but it removes the dress rehearsal for one.
- **Soak and load testing.** `scripts/soak-test.ts` targets staging only and refuses to run
  elsewhere.
- **SHA-bound tenancy release evidence.** This is the live dependency. Ledger item `#057`
  plans to run tenancy evidence against a specific candidate image on staging next. That
  work stalls until staging is available again.

### Pause versus delete

These are materially different and the distinction was the reason the answer was not a
flat yes:

- **Pause** is reversible. The project keeps its ref, its schema and its data, and the
  queued `#057` work can resume when it is unpaused.
- **Delete is irreversible.** Rebuilding means the whole
  [`staging-setup.md`](staging-setup.md) runbook again: a new billable project (about
  $10/month), the full migration chain replayed, fresh keys, and the Railway staging
  environment re-pointed at the new ref. The identity guard in
  `src/lib/supabase/project.ts` will also refuse the new ref until both
  `SUPABASE_STAGING_PROJECT_REF` and `SUPABASE_STAGING_PROJECT_NAME` are set to match.

**Recommendation: pause rather than delete**, unless the intent is to retire the staging
tier permanently, in which case `#057` needs an explicit disposition first.

### Not verified

Live state was not checked. The recorded verification dates are 2026-08-23 for the staging
data tier (211 migration versions, matching production) and 2026-07-30 for the compute
tier. Both are point-in-time facts from
[`staging-setup.md`](staging-setup.md) and may have moved since. Confirming them requires
provider access, which needs explicit approval per AGENTS.md.

---

## 2. Off-ledger repository review

**Scope and method.** The 132 items in `docs/outstanding-issues.md` were read first and
then deliberately excluded, as were the 162 findings of the 2026-09-02 full repository
audit ([`audit/full-repository-audit-2026-09-02.md`](audit/full-repository-audit-2026-09-02.md)),
whose rows are already in the ledger. What follows is only what sits outside both. Each
finding below was independently re-verified against the named file before being written
here.

### Finding 1 (highest consequence): the SaMD classification is open on a live feature

[`samd-classification-medication-considerations.md`](samd-classification-medication-considerations.md)
opens with, verbatim, "**Status:** OPEN — awaiting human/regulatory decision. This note
tracks the consideration; it does **not** assert a classification."

The features it covers are merged and live: the patient-profile panel on
`/medications/[slug]` and the prescribing workspace, plus drug-drug interaction alerting
against the patient's entered medication list. The document itself describes this as "the
app's first **patient-specific decision-support surface**", output tailored to individual
patient parameters rather than the same reference content for everyone.

**Why it matters.** Patient-specific interaction alerting is the shape of function that
Australian regulation treats as clinical decision support, and the classification question
has been parked in a standalone document with nothing pulling it forward. A search of
`docs/outstanding-issues.md` for "TGA" and "SaMD" returns no hits, so no ledger row tracks
it.

**Next step.** This needs a human regulatory decision, not an engineering change. Even a
recorded decision of "assessed, below the threshold, here is the reasoning" would close the
open state. It should not stay open indefinitely while the feature is in use.

### Finding 2: the OpenAI spend threshold alerts but never enforces

- `SPEND_ALERT_DAILY_USD` is defined in `src/lib/env.ts:130`, defaulting to `0`.
- Its only consumer is `src/lib/health-response.ts:94`.
- `src/lib/observability/spend-metrics.ts:215` computes `alerting` as a boolean when
  projected daily spend exceeds the threshold.
- `src/lib/observability/spend-metrics.ts` is imported by exactly two files, `env.ts` and
  `health-response.ts`.

So the threshold produces one boolean inside a secret-gated health probe. Nothing throttles
or halts OpenAI calls when it trips. `src/lib/api-rate-limit.ts` limits by request count
per owner, not by dollars, so it does not cover this either.

**Why it matters.** For a single practitioner funding this personally, a retry storm or a
prompt loop would only surface on the OpenAI bill or on a health endpoint nobody is
watching. A hard circuit breaker that refuses provider calls past a ceiling is a small,
self-contained change and is the missing half of an alert that already exists.

### Finding 3 (minor): password sign-in is built but unreachable

`src/lib/supabase/client.tsx` exports working `signInWithPassword` and `signUpWithPassword`
helpers (lines 33-34, 369-400, 497-515), but
[`multi-user-auth-setup.md`](multi-user-auth-setup.md) records that the shipped sign-in UI
(`auth-panel.tsx`) exposes magic link and OAuth only.

Low stakes for a single-owner tool, and the behaviour is documented rather than accidental.
It is listed here only because nobody has decided whether to finish it, remove it, or leave
it deliberately dormant, and undecided half-features tend to be rediscovered as bugs later.

### Explicitly NOT a finding: a spend panel on the developer hub

A dashboard panel surfacing spend looks like an obvious gap, and it is not one. A `budgets`
panel was removed on 2026-08-25 along with `errors`, `commands`, `decision-log` and
`database-drift`, under plan ruling R1 ("render only facts no green gate already
guarantees"). The comment at `src/lib/developer-area/hub-panels.ts:39-50` closes with "Do
not re-add these five believing they were forgotten."

Recorded here so the next reviewer does not re-propose it. Note the distinction from
Finding 2: that ruling is about _displaying_ spend, and does not speak to _enforcing_ a
ceiling, which nothing currently does.

### Negative result worth recording

`grep` for `TODO`, `FIXME` and `HACK` across `src/` and `worker/` returns **zero matches**.
For a codebase this size that is unusual, and it means informal debt markers are not a
place where work hides here. Everything is either built or tracked in a named document.

---

## 3. Open decisions for the owner

1. **Staging:** pause or delete, and if delete, what happens to ledger item `#057`.
2. **SaMD classification:** obtain the regulatory decision, or record a reasoned
   self-assessment, and close the open status in the document.
3. **Spend ceiling:** decide whether an enforced cap is wanted. If yes, this is a
   well-scoped implementation task.
4. **Password sign-in:** finish, remove, or record as deliberately dormant.
5. **Whether findings 1 to 3 should become ledger rows.** This was offered and not yet
   answered. They are recorded here in the meantime, so they are not lost, but this
   document is a point-in-time record and not the durable ledger.

## 4. What this session did not do

- No source code was changed.
- No verification gate was run, so nothing here carries a gate result.
- No provider (Supabase, Railway, OpenAI) was contacted, and no live state was read.
- Nothing was added to `docs/outstanding-issues.md` or the branch review ledger.
