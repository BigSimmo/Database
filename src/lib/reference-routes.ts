/** Standalone reference pages outside mode namespaces. */

export const COLOUR_CODING_REFERENCE_ROUTE = "/reference/colour-coding";

/** Shared app shell home used when a standalone reference page has no history. */
export const SHARED_APP_HOME_ROUTE = "/";

export function colourCodingReferenceHref(): string {
  return COLOUR_CODING_REFERENCE_ROUTE;
}
