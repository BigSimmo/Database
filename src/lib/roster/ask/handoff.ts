import type { AskIntent } from "@/lib/roster/ask/parse";

/** The request sheet receives structured IDs and date keys only, never the doctor's words. */
export function askIntentHref(intent: AskIntent, teamId?: string | null): string {
  const params = new URLSearchParams();
  if (teamId) params.set("team", teamId);
  if (intent.kind === "give_away" || intent.kind === "cant_make" || intent.kind === "swap") {
    params.set("start", intent.kind);
    params.set("assignment", intent.assignmentId);
    if (intent.kind === "swap" && intent.withUserId) params.set("with", intent.withUserId);
  } else if ("from" in intent) {
    params.set("start", intent.kind);
    params.set("date", intent.from);
    params.set("to", intent.to);
    if (intent.kind === "dates") params.set("kind", intent.dateKind);
  }
  return `/roster/requests?${params.toString()}`;
}
