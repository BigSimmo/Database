# Operator runbook — Auth 10-connection cap (do before the first vertical scale-up)

**Owner:** operator (dashboard action; **not settable via SQL/MCP**).
**When:** complete this _before_ the first compute (vertical) scale-up and before
any horizontal replica add. See the ordering in `docs/deployment-architecture.md`
§2 and the bottleneck analysis in `docs/capacity-review.md` §2–§3.
**Project:** `Clinical KB Database` (`sjrfecxgysukkwxsowpy`), region
ap-southeast-2 (Sydney).

## Why this is the first bottleneck

The Supabase auth server (GoTrue) reaches Postgres through its own internal
application pooler, sized from a **pre-configured direct-connection count that
Supabase attaches to the current compute add-on**. On this project's current
(smallest/shared) tier that pool is small — the advisor finding recorded it as
effectively **~10 absolute connections** (see `docs/process-hardening.md`). Auth
work is bursty and short, but a synchronized sign-in / token-refresh storm
(round start, or a token-refresh storm right after an app deploy) queues behind
those connections and surfaces as login latency or timeouts — a hard,
user-visible failure while the rest of the app still looks healthy.

The trap this runbook exists to prevent: **manually hard-coding
`max_connections` (or a fixed pool size) pins the number and defeats
auto-resize.** Per Supabase's own guidance, "manually configuring the connection
count hard codes it … if you upgrade or downgrade your database, the connection
count will not auto-resize" ([how-to-change-max-database-connections][changemax]).
So if you scale compute up while a fixed absolute allocation is in place, the
auth pool stays pinned at ~10 and the scale-up buys you nothing for auth. The
goal is **proportional / compute-managed allocation**, so raising compute raises
the auth ceiling with it.

## What "percentage-based allocation" means here

Concretely, the desired end state is:

1. `max_connections` is left at the **compute-managed default** (not manually
   pinned), so it auto-resizes with the compute add-on.
2. The Supavisor / PostgREST pool is sized as a **percentage of
   `max_connections`** (Supabase's rule of thumb: keep the pooler ≤ **40 %** of
   Max Connections if you lean on the PostgREST API heavily, up to **80 %**
   otherwise), which **leaves adequate room for the Auth server and other
   utilities** ([connection-management][connmgmt]). This app is PostgREST-heavy
   (the answer path fans out to ~6 hybrid RPCs — `docs/capacity-review.md` §2),
   so stay near the 40 % end.
3. When you scale compute, the auth service pool moves **with** the new
   `max_connections` instead of staying pinned at the old absolute number.

## Exact dashboard path

> The Supabase dashboard evolves; labels below are current as of 2026-07-13.
> Confirm the live label before changing anything — do not force a value that the
> UI does not offer.

1. Sign in to the Supabase dashboard and open the **`Clinical KB Database`**
   project (ref `sjrfecxgysukkwxsowpy`). Confirm the ref in the URL before
   touching any control — it must be `sjrfecxgysukkwxsowpy`, never the stale
   `qjgitjyhxrwxsrydablr`.
2. **Project Settings → Database → Connection pooling** — direct URL
   `https://supabase.com/dashboard/project/sjrfecxgysukkwxsowpy/database/settings`.
   Fields here: **Pool Size** and **Max Client Connections**. Set **Pool Size**
   as a percentage of Max Connections (see §"What … means here" above), not a
   fixed number that eats the auth headroom. Leave headroom explicitly for Auth.
3. **Max Connections:** on **Settings → Compute and Disk** (a.k.a. the
   Infrastructure / Add-ons compute settings). Leave `max_connections` at the
   compute-managed default so it auto-resizes on scale-up. **Do not** pin it via
   the CLI `postgres-config update --config max_connections=<N>` path — that is
   the hard-coding trap above. If it has already been pinned, unset it so the
   value tracks compute again.
4. **Auth service pool allocation:** the per-service (GoTrue) pool is a platform
   allocation, not a first-class self-serve toggle labeled "percentage." If the
   current dashboard exposes a per-service / role connection allocation control,
   set the auth allocation as a **percentage of `max_connections`** rather than a
   fixed absolute count. If it does **not** expose one, the correct action is to
   (a) leave `max_connections` compute-managed, (b) size the pooler by percentage
   as above, and (c) open a Supabase support request to confirm the auth pooler
   scales proportionally on the compute tier you are moving to — cite the
   Advisors "auth connections" finding. Record whichever path applied in the
   verification log below.
5. **Then** perform the vertical scale-up (Settings → Compute and Disk → larger
   add-on). Because `max_connections` is compute-managed, the auth ceiling rises
   with it.

## Verification (definition of done)

- [ ] **Advisors lint clears.** Dashboard → **Advisors → Performance** no longer
      shows the auth-connection allocation finding for
      `sjrfecxgysukkwxsowpy`. (Read-only check — an operator/agent may re-run
      `get_advisors` for the project **with explicit approval**, per the repo's
      provider-confirmation rule.) Paste the before/after advisor state below.
- [ ] **Allocation is proportional, not absolute.** After the scale-up, the auth
      pool / Max Connections both increased (the auth ceiling is no longer pinned
      at ~10). Capture `SHOW max_connections;` before and after, plus the pool
      settings screenshot.
- [ ] **Soak at higher load passes with zero auth failures.** Re-run the
      ward-round soak against **staging** at the higher user count and confirm
      the "Auth failures during ramp = 0" row of the `docs/capacity-review.md` §4
      success table holds (command below).

Higher-load soak (authenticated, staging only — so the sign-in burst actually
exercises the auth pool and bypasses anonymous rate limits; the script refuses
production markers):

```bash
npx tsx scripts/soak-test.ts \
  --target https://<staging-app-host> \
  --confirm-staging \
  --users 60 --duration-s 600 --ramp-s 120 \
  --bearer "$STAGING_ACCESS_TOKEN"
```

## Verification log

| Date | Operator | max_connections before → after | Pool size % | Auth alloc path (self-serve toggle / support) | Advisor lint state | Soak: auth failures @ N users |
| ---- | -------- | ------------------------------ | ----------- | --------------------------------------------- | ------------------ | ----------------------------- |
|      |          |                                |             |                                               |                    |                               |

## Guardrails

- **Confirmation boundary:** touching live Supabase settings requires explicit
  operator action and approval. No agent applies this via SQL/MCP; it is not
  settable that way regardless (this is why the task is 🧑 Operator-owned).
- **Keep single-instance deploys** until this is done — every extra cold app
  instance multiplies token-refresh traffic against the capped auth pool
  (`docs/deployment-architecture.md` §2).
- **Staging only** for the soak. Never point `scripts/soak-test.ts` at
  production; the script fails closed on the production ref anyway.

## References

- `docs/capacity-review.md` §2 (Auth: 10 absolute DB connections) and §3
  (first-bottleneck verdict) and §4 (soak test + success criteria).
- `docs/deployment-architecture.md` §2 (single-instance scale-out plan) and §5
  (why staging must not share the production auth cap).
- `docs/process-hardening.md` (advisor finding, known follow-up debts).
- Supabase docs: [Connection management][connmgmt],
  [How to change max database connections][changemax].

[connmgmt]: https://supabase.com/docs/guides/database/connection-management
[changemax]: https://supabase.com/docs/guides/troubleshooting/how-to-change-max-database-connections-_BQ8P5
