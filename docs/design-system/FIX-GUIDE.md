# Clinical KB design system — Hazard 1–2 fix guide

Single appendix for the closed Hazard 1–2 sweep. **Rules and roles stay in SPEC / TOKENS /
GATES; this file only records dispositions.** A Documented row is not a licence to change
product UI, `globals.css`, or `ckb-v2-tokens.css`.

- **Date:** 27 August 2026
- **Companions:** [README.md](README.md) · [TOKENS.md](TOKENS.md) · [GATES.md](GATES.md) ·
  [COMPONENTS.md](COMPONENTS.md) · [`docs/design-system-contract.md`](../design-system-contract.md) ·
  [`docs/design-system.md`](../design-system.md) (live-layer Geist notes)

Statuses: **Fixed** (code in this sweep) · **Documented** (intentional or already true; no
product change) · **Deferred** (later, named successor) · **Out-of-scope** (explicitly not
this sweep).

Do not invent token values here. Do not snap Geist interpolations to 600/700. Do not copy
mockup `min-h-11` or `--text-soft` body into production.

---

## Batch A — code this sweep

Agents 1–3 land these. Parent verifies after merge; do not treat this table as a second
measurement of `globals.css` / `ckb-v2-tokens.css`.

| ID | Status | Rationale |
| ---- | ---------- | --------- |
| DS-P1-16 | Fixed | Therapy-compass decorative `size={15}` maps to `size-icon-sm` (14px); Lucide `size` prop removed so SVG attrs cannot override the class. |
| DS-P2-03 | Fixed | Unused `--text-{xs,sm,body,md,lg,xl}-lh` / `-tr` companions deleted; keep `--text-hero--line-height` and `--text-hero-tr`. Do not re-require per-step orphans. |
| DS-P2-07 | Fixed | Two `1px` shadow-spread layers dropped in `globals.css` (compare FAB already has a border; disabled send uses a border, not inset+border). |
| DS-P2-12 | Fixed | Three raw `line-height` literals in `globals.css` map to existing named tokens (`--text-hero--line-height`, `--leading-prose`). Not `--leading-tight`. |
| DS-P2-13 | Fixed | Specifier surfaces that already own the edge with `border` lose `shadow-inset`. True wells, segmented tracks, field-controls, and Ward stay. |
| DS-P2-17 | Fixed | `differential-detail-page` uses `resolveScrollBehavior()`; `settings-dialog` already branches on reduce-motion and is left alone. |
| DS-P2-25 | Fixed | `#0f766e` medication accent defaults stay data, not `--clinical-accent`. Scoped `RAW_COLOR_EXEMPTIONS` entry; `rawColorLiterals` 2→0. See below. |

---

## Batch B — docs dispositions

| ID | Status | Rationale |
| ---- | ---------- | --------- |
| DS-P2-04 | Documented | Intentional Geist variable interpolation. Already explained in [`docs/design-system.md`](../design-system.md) (intermediate weights; do **not** snap to 600/700). |
| DS-P2-22 | Documented | `SectionHeading` exists (`src/components/ui/section-heading.tsx`); 14 production call sites. No opportunistic migration this sweep. |
| DS-P2-23 | Documented | `AnswerCard` `frame?: "raised" \| "bare"` — both valid. Production answer surface uses **bare**. Future visual baselines must include both. Do not commit screenshots. |
| DS-P2-27 | Documented | 15-mode load: recommend first-run / Tools prominence later. No IA redesign this sweep. |
| DS-P2-28 | Documented | Settings **Motion** already has a per-control description. **Recent searches on home** does not — docs recommendation only; no extra intro copy in product this sweep. |
| DS-P2-29 | Deferred | Phone document-viewer density waits on the tap-floor (Hazard ≥3). |
| DS-P2-30 | Documented | Toast primitive exists; there is no **universal network-error** toast. Do not build toast infra here. `OverlayRoot` remains the overlay owner. |
| DS-P2-31 | Documented | Already in TOKENS §4 / SPEC §3: add `--kind-*` **with the first call site**. No values in this sweep. |
| DS-P2-32 | Documented | `--text-placeholder` is **live** (globals + v2 + `placeholder:` consumers), not planned. TOKENS §5 corrected. No further role migration. |
| DS-P2-33 | Documented | Contract `textSoftConsumers=0` in production. Keep the `--text-soft` alias until zero `var(--text-soft)` remain **including mockups**. Do not rename; do not delete this sweep. |
| DS-P3-01 | Deferred | PR-9 plan. `--shadow-focus` and dead springs are already gone. `--shadow-lift` still has live `mode-nav` and `document-search-results` consumers — do **not** delete it. |
| DS-P3-02 | Documented | TOKENS already: `--tone-*` frozen, not deleted. |
| DS-P3-03 | Documented | TOKENS already: design-side `--quantity-unit-scale` never lands. |
| DS-P3-04 | Documented | TOKENS already: ConfidenceMeter deferred; no token without a call site. |
| DS-P3-05 | Documented | Registry has **55** registered visual exports. `DocumentFrame` is built shell-only and still unregistered. Register when print primitives ship (PR 11). Docs elsewhere may still say 53/54. |
| DS-P3-07 | Documented | Full visual state matrix grows incrementally with new adoptions. |
| DS-P3-08 | Documented | QA checklist: inspect the filter band at 414–430px. No code this sweep. |
| DS-P3-09 | Documented | `#TYZK23` PWA install CLS already fixed (PR #2253). Regression-check note only; no speculative CSS. |
| DS-P3-10 | Documented | Mockup `min-h-11` and `--text-soft` body must not leak into production. |

---

## Medication accent literals (DS-P2-25)

The two remaining production raw-colour hits are `#0f766e` defaults in
`src/lib/medications.ts` and `src/lib/medication-records.ts`. They restate a Postgres column
default (`accent text not null default '#0f766e'`) for a per-record, user-chosen colour.
SPEC already records this as **data, not a token**.

Do **not** map them to `--clinical-accent` (that role is `--primary-500` and would recolour
medication records). The contract exemption is **scoped to those accent defaults**, not a
whole-file blank cheque on either module. Enumerated in `RAW_COLOR_EXEMPTIONS` in
`scripts/design-system-contract-utils.mjs`; described for operators in
[`docs/design-system-contract.md`](../design-system-contract.md).

---

## Out of scope this sweep (do not implement)

P0/P1 tap-floor · Button / PageHeader / v2 full adoption · Ward family · type-step
retirement · toast infrastructure · `--kind-*` values · `--text-soft` global rename ·
deleting live `--shadow-lift` · ConfidenceMeter · `DocumentFrame` registry · screenshot
capture · `npm run ensure` unless a visual defect is proven.

---

## Residual risk (unchanged by docs)

- Remaining production `border` + `inset` outside the specifier surfaces edited in DS-P2-13.
- Lucide `size={15}` was ungated (`check:icon-scale` only bans `*-4.5`).
- `--shadow-lift` still live (`mode-nav`, `document-search-results`).
- Mockup `--text-soft` still blocks alias deletion.
- Mockup `min-h-11` must stay mockup-only.
