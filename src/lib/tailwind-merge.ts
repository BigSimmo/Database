import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge, taught this repo's `@theme`.
 *
 * `cn()` used to be a plain `join(" ")`, so a later class could not override an
 * earlier one and every size/colour override had to be worked around at the call
 * site (see the notes in `page-header.tsx`, `document-search-results.tsx`,
 * `master-search-header.tsx` and `mode-home-template.tsx`). twMerge fixes that —
 * but ONLY if it is told about the scales Tailwind generates from
 * `src/app/globals.css`, which is the single source of truth for every name below.
 *
 * Two distinct failure modes motivate this config; both are silent, with no type
 * or lint signal:
 *
 *  1. **Misclassification (deletes a class).** Stock tailwind-merge falls back to
 *     "text colour" for any `text-<x>` it does not recognise as a font size. Its
 *     built-in font-size scale is t-shirt-shaped, so `text-2xs` / `text-3xs`
 *     happen to survive, but `text-sm-minus`, `text-base-minus`, `text-lg-minus`,
 *     `text-2xl-minus`, `text-2xl-compact`, `text-3xl-minus` and `text-hero` do
 *     not — each was measured being **deleted** when it met the sibling
 *     `text-[color:var(--text-muted)]` in the same `cn()` call. `eyebrowText` is
 *     exactly that pair. Declaring the scale under `theme.text` moves them into
 *     the font-size group, where they belong.
 *
 *  2. **Non-recognition (silently fails to merge).** `size-icon-md`,
 *     `tracking-label`, `leading-prose`, `ease-out-soft`, `animate-shimmer` and
 *     `pt-safe` are not in any stock scale, so twMerge passes them through
 *     untouched and a later `size-icon-lg` does not replace them — the same
 *     override failure `cn()` is being changed to fix.
 *
 * Declaring a family is not free: it changes which class wins at any call site
 * that already writes two of them. Every family below was measured against all
 * 1 409 `cn()` call sites and introduces **zero** new class deletions. The one
 * family that did — `--spacing-tap` — is held back, for the reason recorded
 * against `spacing` below.
 *
 * Radius (`--radius-xs … --radius-2xl`) and the font families reuse Tailwind's own
 * names, so they need no entry. `--shadow-*` are plain custom properties consumed
 * as `shadow-[var(--shadow-tight)]`; they generate no `shadow-<name>` utility and
 * stock twMerge already groups the arbitrary form correctly. `--spring-*` sit
 * outside a Tailwind namespace and generate nothing.
 *
 * Adding a token to `@theme` in `globals.css` means adding it here too.
 */
export const CLINICAL_TWMERGE_THEME = {
  // globals.css @theme --text-* — size-only steps (no baked leading/tracking).
  // `3xs`/`2xs` already resolve as t-shirt sizes; listed so the scale reads
  // whole and stays correct if that heuristic ever narrows.
  text: ["3xs", "2xs", "sm-minus", "base-minus", "lg-minus", "2xl-minus", "2xl-compact", "3xl-minus", "hero"],

  // globals.css @theme --leading-* — the two steps Tailwind's scale cannot
  // express. Tailwind still owns tight/snug/normal/relaxed.
  leading: ["display", "prose"],

  // globals.css @theme --tracking-* — five named roles. `normal` is also a
  // stock name and needs no entry, but is listed to keep the role set whole.
  tracking: ["display", "normal", "label", "eyebrow", "kicker"],

  // globals.css @theme --spacing-* — generates size-icon-* / h-icon-* /
  // w-icon-* and the mode-home composer reserves. `safe` / `safe-2` are the
  // @utility pt-safe / pb-safe / pb-safe-2 rules further down globals.css,
  // which are padding utilities and should conflict with pt-*/pb-* like any
  // other.
  //
  // `tap` (--spacing-tap, the 48px target knob) is DELIBERATELY ABSENT, and
  // this is the one omission that is not an oversight. Tailwind emits
  // `.min-h-tap` after every numeric `.min-h-*` and `.h-tap` after `.h-4` /
  // `.h-10.5`, so at equal specificity the tap token wins today wherever a
  // call site pairs the two. Declaring `tap` here would hand the win to the
  // later class instead — measured across 22 call sites (document-admin,
  // DocumentManagerPanel, favourites-hub, settings-dialog, service-detail-page,
  // form-detail-page, clinical-output-helpers, account-setup-dialog), 18 of
  // which would drop from 48px to 32/36/40/42px. AGENTS.md and SPEC §4.10 are
  // explicit that no production target is ever reduced, so the merge stays off
  // for this family until those sites drop the numeric class they already
  // cannot apply. Until then `min-h-tap min-h-9` passes through unmerged,
  // exactly as it does today; `tests/tailwind-merge-config.test.ts` pins that.
  spacing: [
    "icon-xs",
    "icon-sm",
    "icon-md",
    "icon-lg",
    "icon-xl",
    "mode-home-composer-phone",
    "mode-home-composer-wide",
    "safe",
    "safe-2",
  ],

  // globals.css @theme --ease-*.
  ease: ["out-soft", "spring"],

  // globals.css @theme --animate-*.
  animate: ["fade-up", "overlay-in", "sheet-up", "sheet-left", "pop-in", "dialog-rise", "action-tray-in", "shimmer"],
} as const;

export const twMergeClinical = extendTailwindMerge({
  // Spread rather than inline so `tests/tailwind-merge-config.test.ts` can compare
  // this exact object against the `@theme` block in globals.css. A token added to
  // one and not the other is the silent failure this whole module exists to stop.
  extend: { theme: { ...CLINICAL_TWMERGE_THEME } },
});
