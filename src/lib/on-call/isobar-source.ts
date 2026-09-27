/**
 * The WA source for the "Calling a consultant" card on Call (plan 3.2).
 *
 * The card shows the iSoBAR handover headings exactly as the WA Health policy
 * prints them, with that policy's link and the day it was read. Nothing here is
 * written from memory: both values stay empty until the `sources` skill has
 * captured the official page (a `health.wa.gov.au` or `wa.gov.au` https URL),
 * and the card does not render while `ISOBAR_SOURCE` is null.
 */
export type IsobarSource = {
  readonly publisher: string;
  readonly title: string;
  readonly url: `https://${string}`;
  /** The day the page was read, as `YYYY-MM-DD`. */
  readonly readOn: string;
};

/** Null until captured with the `sources` skill. The card does not render while this is null. */
export const ISOBAR_SOURCE: IsobarSource | null = null;

/** The letters and heading words exactly as the WA source prints them; empty until the source is captured. */
export const ISOBAR_HEADINGS: readonly { readonly letter: string; readonly heading: string }[] = [];
