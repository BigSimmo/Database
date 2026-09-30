export type RequestSent = (message: string, undo?: () => Promise<void>) => void;

/** A shift starting within a day is reported to the manager instead of offered around. */
export const URGENT_GIVE_AWAY_MS = 86_400_000;

export function isUrgentGiveAway(startsAt: string, now: Date): boolean {
  return Date.parse(startsAt) - now.getTime() < URGENT_GIVE_AWAY_MS;
}

export const GIVE_AWAY_WORDS = {
  urgentTitle: "I can't make my shift",
  title: "Give a shift away",
  ringIn: "You still ring in as usual.",
  urgentButton: "I can't make it",
  told: "Your manager has been told",
} as const;
