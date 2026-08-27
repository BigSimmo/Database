# Operator guidance: Supabase preview-branch compute cap (#9X40BT)

This document records the operator configuration and cost-containment policy for Supabase preview branches on project `sjrfecxgysukkwxsowpy` (`Clinical KB Database`).

## 1. Problem context & cost boundary

- **Cost exposure:** Supabase preview branches run dedicated compute instances for each open pull request that touches `supabase/**`. Branching Compute is **not covered by the organization's Spend Cap**.
- **Historical default:** Automatic branching was enabled with a default limit of 3 concurrent preview branches.
- **Risk:** High PR concurrency touching database files could trigger unexpected, uncapped compute billing outside the configured spend limits.

## 2. Independent CI verification invariant

Lowering or disabling automatic branching does **not** weaken migration verification:

- CI's **Migration replay** job (`db-reset-verify` in `.github/workflows/ci.yml`) independently replays the entire migration sequence (`supabase migration up --local`) on every pull request touching database migrations or schema files.
- Local emulator replay catches syntax errors, dependency ordering issues, and table invariant violations before merge without incurring hosted compute charges.
- Preview branches serve as an optional secondary validation layer rather than the sole migration gate.

## 3. Operator configuration

- **Dashboard path:** Supabase Dashboard → **Project Settings** → **Integrations** → **GitHub**.
- **Action:**
  - Lower **Automatic branching** limit from `3` to `1` (or set to manual / disable as needed).
  - Ensure **"Supabase changes only"** is checked so non-database PRs never provision a branch database.
- **Status check:**
  - Read-only branch inspection (`supabase` MCP `list_branches` on `sjrfecxgysukkwxsowpy`) confirms **zero active preview branches** (only the production `main` branch is present).
  - Active preview compute spend is \$0.

## 4. Governance & safety rules

- Per `AGENTS.md` § "Supabase project safety", automated agents must not modify project settings without explicit owner authorization.
- Production schema deployments occur automatically upon merging to `main` via the GitHub integration ("Deploy to production" enabled for `main`).
- Any manual branching creation or limit increase for heavy staging validation must be cleaned up immediately upon PR closure.
