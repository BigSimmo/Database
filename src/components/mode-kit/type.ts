/**
 * The shared mode type rule (mode design standard §1: premium, mature, nothing
 * thick). The weights already exist as tokens (`--font-weight-body` 400,
 * `--font-weight-label` 500, `--font-weight-heading` 600 in
 * `src/app/ckb-v2-tokens.css`), and Tailwind's `font-normal`, `font-medium` and
 * `font-semibold` produce exactly those values; `nums` is the repo's tabular
 * figures utility. Nothing on a mode page is heavier than 600.
 *
 * Sizes use the v2 scale: `text-xs` 12, `text-sm` 13, `text-base-minus` 15,
 * `text-lg-minus` 17, `text-xl` 20, `text-2xl` 24, and `text-2xs` for eyebrows
 * only. Nothing is smaller than 11px for a label or 13px for body text.
 */

/** Phone numbers and figures: 400, tabular, slightly open. Never bold, never truncated. */
export const modeNumberText = "font-normal nums tracking-wide";
/** Names, roles, row titles: 500. */
export const modeNameText = "font-medium";
/** Page and group headings, the one strongest step on a mode page: 600. */
export const modeHeadingText = "font-semibold";
/** The one display figure (the desk-dial sheet): 300, allowed from 28px up. */
export const modeDisplayNumberText = "font-light nums tracking-wide";
/** Secondary lines: 13px, muted. */
export const modeSecondaryText = "text-sm text-[color:var(--text-muted)]";
