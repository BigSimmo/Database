// Canonical semantic tone system for badges, chips, and compact status labels.
//
// This is the single source of truth for the six clinical badge tones described
// in `docs/clinical-badge-system-guide.md`. It is intentionally framework-free
// (no JSX, no lucide runtime) so server code, the worker, and tests can import
// tone priority/meaning without pulling in the React render layer. The render
// layer (`src/components/clinical-dashboard/clinical-badge.tsx`) maps these tones
// to token classes and icons.

export type SemanticTone = "neutral" | "clinical" | "success" | "warning" | "danger" | "info";

// Highest urgency first. Used to order badge clusters so the most important
// safety signal is never truncated away behind passive metadata.
export const SEMANTIC_TONE_PRIORITY: Record<SemanticTone, number> = {
  danger: 6,
  warning: 5,
  clinical: 4,
  success: 3,
  neutral: 2,
  info: 1,
};

// Tones in descending priority order (danger → info). Handy for legends/tests.
export const SEMANTIC_TONES: readonly SemanticTone[] = ["danger", "warning", "clinical", "success", "neutral", "info"];

// Semantic icon keys resolved to Lucide components at the render boundary. Kept
// as strings here so data modules (medication badges, the flag catalogue) can
// name an icon without depending on lucide-react.
export const SEMANTIC_ICON_KEYS = ["danger", "warning", "controlled"] as const;
export type SemanticIconKey = (typeof SEMANTIC_ICON_KEYS)[number];

export type SemanticToneMeta = {
  /** Human-facing tone name for legends and docs. */
  label: string;
  /** What the tone means / when to use it. */
  meaning: string;
  /**
   * Short prefix announced to assistive tech before the badge label so meaning
   * survives without colour, e.g. "Do not use: Cr >120 avoid". Empty for tones
   * whose label already reads plainly and carry no urgency.
   */
  ariaPrefix: string;
  /**
   * Whether the tone renders a default status icon so it is distinguishable
   * without colour (forced-colors / colour-blind). Only the two safety tones
   * opt in; the rest stay quiet per the guide ("icon only when useful").
   */
  defaultIcon: boolean;
};

export const SEMANTIC_TONE_META: Record<SemanticTone, SemanticToneMeta> = {
  danger: {
    label: "Danger",
    meaning: "Stop, avoid, contraindicated, failed, outdated, or unsafe.",
    ariaPrefix: "Do not use",
    defaultIcon: true,
  },
  warning: {
    label: "Warning",
    meaning: "Pause, check, adjust, review, or interpret with caution.",
    ariaPrefix: "Caution",
    defaultIcon: true,
  },
  clinical: {
    label: "Clinical",
    meaning: "A clinical action or instruction to carry out. Not a trust or safety signal.",
    ariaPrefix: "",
    defaultIcon: false,
  },
  success: {
    label: "Success",
    meaning: "Confirmed, current, reviewed, available, or source-backed. Not clinical safety.",
    ariaPrefix: "",
    defaultIcon: false,
  },
  neutral: {
    label: "Neutral",
    meaning: "Reference metadata or a passive fact that needs no action.",
    ariaPrefix: "",
    defaultIcon: false,
  },
  info: {
    label: "Info",
    meaning: "System or process state. Rare in clinical content.",
    ariaPrefix: "",
    defaultIcon: false,
  },
};

/**
 * Stable, priority-sorted copy (highest urgency first). Insertion order is
 * preserved within a tone, matching the previous medication badge behaviour.
 */
export function sortBySemanticTonePriority<T extends { tone?: SemanticTone }>(items: T[]): T[] {
  return [...items].sort(
    (left, right) => SEMANTIC_TONE_PRIORITY[right.tone ?? "neutral"] - SEMANTIC_TONE_PRIORITY[left.tone ?? "neutral"],
  );
}
