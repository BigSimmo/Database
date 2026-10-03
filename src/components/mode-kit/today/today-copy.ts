/**
 * The six shared Today states, in one place so every mode says the same thing
 * in the same words. A mode passes its own name; nothing else varies.
 *
 * Honest by rule: "empty" is said only when every read succeeded, and
 * "failed" never pretends there is nothing to do.
 */
export type TodaySharedStateKind = "loading" | "signed-out" | "failed" | "offline" | "empty" | "demo";

export const todayStateCopy = {
  loading: (mode: string) => ({ title: `Loading ${mode}` }),
  "signed-out": (mode: string) => ({
    title: "Sign in to see your day",
    body: `${mode} shows your own records, linked to your account only. Nothing is shared.`,
    action: "Sign in",
  }),
  failed: (mode: string) => ({
    title: `Couldn't load ${mode}`,
    body: "Nothing is shown rather than a guess. Check your connection and try again.",
    action: "Try again",
  }),
  // A failed read because the device is offline, for a mode whose offline copy
  // is incomplete (Admin's cache holds no compliance rows), so nothing is shown.
  failedOffline: (mode: string) => ({
    title: "You're offline",
    body: `${mode} needs a connection to show your records. Nothing is shown rather than an incomplete list.`,
    action: "Try again",
  }),
  offline: (mode: string) => ({
    title: "You're offline",
    body: `${mode} is showing what this device saved last time, which may be out of date.`,
    action: "Try again",
  }),
  empty: (mode: string) => ({
    title: "Nothing needs you right now",
    body: `${mode} checked everything it reads.`,
  }),
  demo: () => ({
    title: "Demo data",
    body: "These items are invented examples, not your records.",
  }),
} as const satisfies Record<
  TodaySharedStateKind | "failedOffline",
  (mode: string) => { title: string; body?: string; action?: string }
>;

/** How many "Needs you" rows show before "See all (n)". */
export const TODAY_NEEDS_YOU_LIMIT = 3;

/** The fixed slot order (spec): one place, read by the shell and its test. */
export const todaySlotOrder = [
  "status",
  "safety",
  "now",
  "needs-you",
  "coming-up",
  "at-a-glance",
  "shortcuts",
] as const;
export type TodaySlot = (typeof todaySlotOrder)[number];
