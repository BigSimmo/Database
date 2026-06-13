# Changelog — Premium Redesign

## Rebuild

- **Guide modal → responsive `Sheet`** (`ClinicalDashboard.tsx`, `ui/sheet.tsx`): bottom sheet on mobile, centred dialog on desktop, with enter/exit animation, drag grip, focus trap, focus return, and safe-area padding. Accessible name `Clinical KB guide` and `Close guide` label preserved.
- **Document scope picker → mobile bottom sheet** (`MasterSearchHeader` in `ClinicalDashboard.tsx`): the `<details>` popover now rises as a full-width bottom sheet (scrim, drag grip, `sheet-up` animation, safe-area) below `sm:`, and stays an anchored `pop-in` popover from `sm:` up. Element type, `data-testid="scope-command-popover"`, `aria-label="Open document scope"`, and `data-testid="document-scope-filter"` unchanged.
- **Rename / delete dialogs → `Sheet`** (`DocumentManagementActions.tsx`): same responsive sheet/dialog pattern; `Close document action` label preserved; the focused input is restored via `initialFocusRef`.

## Upgrade

- **Token system** (`globals.css`): 12-step tinted neutral ramp + AA-tuned primary ramp + semantic triads (`-text`/`-bg`/`-border`), all re-pointed under existing variable names; type scale `text-2xs` + `nums` (tabular-figures) utility; radius scale (`rounded-lg` controls → `rounded-xl` cards → `rounded-t-2xl`/`2xl` sheets); 2–3 layer low-alpha shadow system; motion tokens (`--duration-*`, `--ease-out-soft`, `--ease-spring`) + keyframes (`fade-up`, `overlay-in`, `sheet-up`, `pop-in`, `shimmer`); `@theme inline` colour bridge.
- **Component primitives** (`ui-primitives.tsx`): cards → `rounded-xl` + layered shadows + hover lift; `primaryControl` gains a top-highlight inset and hover elevation; focus ring moved from hardcoded `ring-teal-300/20` to the `--focus` ramp token; tone classes use the new semantic `-border` tokens; eyebrow uses `text-2xs`.
- **New `ui/` components**: `Sheet`, `Skeleton`/`SkeletonText`, `Button`, `IconButton`, each with full state coverage; `LoadingPanel` gained a `variant="skeleton"`.
- **Answer reading experience** (`PlainAnswerResponse`): 16px / 1.7 reading body, `68ch` measure cap, `rounded-xl` surface, `fade-up` entrance.
- **Scope rows re-tokenised**: the scope list previously used dark-only hardcoded `white/N` + `slate-*` + `teal-*` classes that rendered poorly in light mode; now fully semantic so it is correct in light, dark, and the bottom sheet.

## Polish

- Mobile bottom nav: `pb-safe-2` safe-area utility + tabular-figure count badges.
- Document viewer: tabular figures on the page input, `of N`, and `Hit X of Y`.
- Reduced-motion: removed the `transform: none !important` blanket that broke optical centring.
- Safe-area utilities (`pt-safe`, `pb-safe`, `pb-safe-2`) and `nums` available app-wide.
