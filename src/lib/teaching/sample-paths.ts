/*
 * The Teaching sample's addresses, safe for the browser. The server half,
 * which reads the cookie, is `sample.ts`.
 */
export const TEACHING_SAMPLE_COOKIE = "psychsift_teaching_sample";
export const TEACHING_SAMPLE_PATH = "/teaching/sample";

/** Only Teaching pages (never the switch itself) are valid places to land after entering or leaving the sample. */
export function teachingSampleReturnPath(next: string | null | undefined): string {
  if (!next || !/^\/teaching(?:[/?#]|$)/.test(next) || next.startsWith(TEACHING_SAMPLE_PATH)) return "/teaching";
  return next;
}

/** The link "Open the demo" follows from a signed-out Teaching page, returning the reader to that page. */
export function teachingSampleEntryHref(returnTo: string | null | undefined): string {
  return `${TEACHING_SAMPLE_PATH}?${new URLSearchParams({ next: teachingSampleReturnPath(returnTo) })}`;
}
