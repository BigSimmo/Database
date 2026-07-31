# design-sync notes — Clinical KB

- This repo is the Next.js app itself, not a component library: no `dist/`, no
  Storybook. The sync uses the package shape with a hand-authored entry at
  `.design-sync/entry.tsx`, passed to the converter via `--entry` (the driver
  takes the same flag). Scope (user-confirmed 2026-07-13): the UI-primitives
  layer + tokens only — app-level components (ClinicalDashboard, DocumentViewer,
  mockups) depend on Supabase/Next internals and are out of scope.
- Styling is Tailwind v4 (`@import "tailwindcss"` in `src/app/globals.css`,
  tokens in `@theme` + `:root`/`.dark`). There is no static stylesheet:
  `cfg.buildCmd` compiles one with `@tailwindcss/cli` (installed into
  `.ds-sync/`, not the repo lockfile) into `.design-sync/.cache/compiled.css`,
  then appends `.design-sync/font-vars.css`. Tailwind v4 auto-scans the repo
  for class usage, so authored previews under `.design-sync/previews/` are
  picked up — always run `buildCmd` before the converter after editing previews.
- Fonts: the app loads Geist/Geist Mono via `next/font/google` (runtime vars
  `--font-geist-sans`/`--font-geist-mono`). The bundle ships them from the
  `geist` npm package (OFL) installed in `.ds-sync/`; `font-vars.css` maps the
  variables to the family names.
- `.ds-sync/` is gitignored scratch: re-syncs must re-run
  `npm i esbuild ts-morph @types/react @tailwindcss/cli geist` inside it.
- Worktrees in this repo start without `node_modules` — run `npm ci` first.
- `SourceProvenance`/`SourceStatusBadge` metadata field is
  `clinical_validation_status` (NOT `validation_status`) — wrong key silently
  falls back to "Not locally validated".
- `Sheet` renders `position:fixed`; its preview wraps stories in a
  transformed, explicitly-sized container (see `previews/Sheet.tsx`) so the
  overlay stays inside the card. Keep that wrapper on any preview edit.
- Default `guidelinesGlob` swept 46 repo process docs into `guidelines/` —
  the config pins a curated 5-file design set; keep it curated.

## Known claude.ai/design validator findings (accepted, do not "fix")

From the July 2026 design-side review (CLAUDE_CODE_FIXES.md): the design app's
validator flags on our compiled-Tailwind output that are heuristic noise, not
repo defects — re-flag to the design agent instead of restructuring CSS:

- "56 unregistered component-scoped custom properties" — all `--tw-*` Tailwind
  runtime vars + `--footer-scrim-height` (component-local by design).
- "126 pseudo theme scopes" — Tailwind utility classes misread as themes.
- README token count vs stylesheet count — converter/validator counting
  difference (`317 defined` includes non-`:root` definitions).
- `--text-hero` font-family misparse — mitigated 2026-07-14 by adding the
  `--text-hero--line-height` companion; if the warning persists it is
  design-app-side.

## Known render warns

- Renders themselves stay clean: 10/10, no thin/blank/variantsIdentical flags
  (re-confirmed 2026-07-30).
- `[TOKENS_MISSING]` 7 CSS custom properties — triaged 2026-07-30, all seven
  are **expected in the bundle**, so the warn line itself is known. Four are
  benign by construction (runtime-set or scan artifacts); the other three were
  genuinely undefined references in repo code and were repaired across PRs
  #1480 and #1451. The warn count only drops on the next re-sync, once the
  bundle is rebuilt from the repaired source:
  - `--mobile-composer-reserve` — set at runtime by
    `clinical-dashboard/mobile-composer-reserve.ts` and always read through a
    `var(…, 0rem)` fallback. Never in a static stylesheet. Do not "fix".
  - `--x` — Tailwind v4 scans the whole repo, found the literal string
    `bg-[color:var(--x)]` in `docs/redesign/03-decision-log.md` prose, and
    emitted a class for it. An artifact of documenting a class name; nothing
    renders it.
  - `--med-accent`, `--med-accent-border` — also runtime-set, not defects.
    `medicationAccentStyle()` in
    `clinical-dashboard/medication-record-page.tsx:88-94` assigns both (plus
    unread `--med-accent-soft`, which is not one of the seven missing tokens;
    that dead-plumbing question is tracked separately as #157), and that style
    object is applied to the ancestor that contains every referenced class
    (`:393`). A stylesheet-only missing-token scan cannot see React `style`
    assignments; do not "fix" these.
  - `--clinical-accent-strong`
    (`clinical-dashboard/answer-status.tsx:252`) — resolved by mapping the role
    to `--primary-700` in both themes and `LinkText` in forced-colors,
    with contrast and token-presence contracts in
    `tests/design-token-contract.test.ts`.
  - `--primary-hover`, `--success-hover` —
    `favourites-page-mockups/favourites-library-redesign-page.tsx`, which is
    gate-exempt design scratch. Repaired by mapping to `--primary-strong` and
    `hover:brightness-110` respectively; the success family has no darker step.
- If a future sync sees a **different** var in the `[TOKENS_MISSING]` warn, that
  one is new — look at it before recording it.

The triage rule this warn needs, since it fires on both: a custom property is
correct-as-reported when it has a runtime setter or is always read through a
`var(…, fallback)`. It is a real defect when it has neither — the whole
declaration is then dropped at CSS parse time and the colour silently does not
apply. Check for a setter or fallback before calling a new report noise, and
for the absence of both before calling it a defect.

## Re-sync risks

- The compiled stylesheet (`.design-sync/.cache/compiled.css`) is generated by
  `cfg.buildCmd` from `src/app/globals.css` + repo-wide class scanning; it goes
  stale whenever globals.css or component class usage changes — always run
  `buildCmd` before the converter.
- The Geist fonts and Tailwind CLI live in gitignored `.ds-sync/` — a fresh
  clone must reinstall them with
  `npm install --prefix .ds-sync --no-save --package-lock=false esbuild ts-morph @types/react @tailwindcss/cli geist`
  or the build fails on `extraFonts`/`buildCmd`.
- Preview props were sanity-checked against component sources on 2026-07-13;
  ui-primitives / sheet / AccessibleTable API changes can silently make the
  authored previews unrepresentative — the driver re-verifies changed
  components, but prop renames need preview edits.
- The `prompt-for-codex-medical-knowledge-base` import specifier in previews is
  the package.json `name`; if the repo is renamed, update previews + config.
- `conventions.md` drifts silently when the token set moves. The 2026-07-30
  re-sync caught two dead claims after the Clinical Sky port: a `-solid` /
  `-solid-contrast` pair claimed for every status family when only `danger`
  has one, and `controlBase` listed as module-private when
  `ui-primitives.tsx:34` exports it. Re-validate every enumerated token/class/
  icon against `ds-bundle/_ds_bundle.css` (definitions only — match
  `--name\s*:`, not bare `var(--name)`, or referenced-but-undefined vars read
  as defined) and the bundle's export list on every re-sync. A helper lives at
  `.design-sync/.cache/validate-conventions.mjs` (gitignored, cheap to rewrite).
- The driver reports the token port as `changed: []` with `sourceKeys`
  unchanged: `sourceKeys` track the authored preview + preview-affecting config,
  NOT component source. A component-source or token change surfaces instead as
  render churn (`canary`/`[SPOT_CHECK]`) plus `styling: true`. Grade the
  spot-check sheets — the churn is real even though nothing is listed "changed".
