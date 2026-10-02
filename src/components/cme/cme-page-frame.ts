/**
 * The page frame every CPD page shares, so the mode reads as one surface: one
 * `<h1>` treatment and one content width.
 *
 * The title takes `PageHeader`'s scale, leading, tracking and heading colour
 * (`src/components/ui/page-header.tsx`) at CPD's heading weight. `PageHeader`
 * itself sets its title extrabold, which CPD never uses (headings 600 — see
 * `tests/cme-type-weight.test.ts`), so CPD pages keep their own `<h1>` with this
 * class rather than mounting it.
 */
export const cmePageTitle =
  "text-balance text-2xl font-semibold leading-tight tracking-tight text-[color:var(--text-heading)]";

/** The one CPD content width: a reading column on desktop, the full phone width less its gutter. */
export const cmePageWidth = "mx-auto w-full max-w-3xl";
