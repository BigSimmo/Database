import type { CoverCount } from "@/lib/roster/team/cover";

/**
 * How a cover count is drawn. Short is red and over is blue, each with the words
 * beside it, so colour is never the only cue; met stays plain.
 */
export const COVER_TONE: Readonly<Record<CoverCount["state"], string>> = {
  short: "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-text)]",
  over: "border-[color:var(--info-border)] bg-[color:var(--info-bg)] text-[color:var(--info-text)]",
  met: "border-transparent",
};

/** Screen reader words for the states that are not simply met. */
export const COVER_STATE_WORDS: Readonly<Record<CoverCount["state"], string>> = {
  short: " (short)",
  over: " (over)",
  met: "",
};
