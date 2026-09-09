export type DocumentSearchUnavailableStatus = "error" | "unauthorized";

/**
 * Derive the Documents-mode fault message and the band status it pairs with.
 *
 * These two must be produced from one chain. Deriving them separately let an
 * expired session ("Sign in again…") render under the band's generic
 * "Couldn't search" headline, which tells the reader the search broke when in
 * fact it never ran for want of a session. Precedence is deliberate: an
 * unreachable API outranks an expired session, because a signed-in retry
 * cannot fix an API that is down.
 */
export function deriveDocumentSearchUnavailable(input: {
  apiUnavailable: boolean;
  authUnavailable: boolean;
  realDataReady: boolean;
  setupWarning: string | null;
  deployedClinicalKb: boolean;
}): { message: string; status: DocumentSearchUnavailableStatus } | null {
  if (input.apiUnavailable) {
    return {
      message: input.deployedClinicalKb
        ? "PsychSift could not be reached. Check your connection and try again shortly."
        : "The local API is unavailable. Check the app server before searching documents.",
      status: "error",
    };
  }
  if (input.authUnavailable) {
    return {
      message: "Your session expired. Sign in again to view private indexed documents.",
      status: "unauthorized",
    };
  }
  if (!input.realDataReady) {
    return {
      message: input.setupWarning || "Complete the search setup before using Documents mode.",
      status: "error",
    };
  }
  return null;
}
