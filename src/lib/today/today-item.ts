import type { AppModeId } from "@/lib/app-modes";

/**
 * The one shape every "what needs you" line takes, whichever mode it comes
 * from: My Day's merged list, a mode's own Today page, and any feature that
 * offers items to them (roster changes, credential renewals, sign-off queues).
 *
 * A producer maps its own facts onto this shape with its own selectors; it
 * never re-derives another mode's rules. Consumers sort with the shared order:
 * `overdue` first, then `soon`, then `info`; within a band by `due`, earliest
 * first, with undated items last.
 *
 * Privacy: an item is display text for the signed-in reader on their own
 * screen. It is never stored on a server or sent anywhere. `title` and
 * `detail` must not carry patient identifiers; any bed or initials label goes
 * through the shared on-device patient-label store, never into an item.
 */
export type TodaySeverity = "overdue" | "soon" | "info";

/** Overdue first, then due soon, then the rest. */
export const todaySeverities = ["overdue", "soon", "info"] as const satisfies readonly TodaySeverity[];

export interface TodayItem {
  /**
   * Stable and unique across every producer: `<mode>:<kind>:<record id>`,
   * e.g. `roster:swap:42` or `my-work:date:abc`. Two producers that describe
   * the same fact must agree on one id, so a merged list shows it once.
   */
  readonly id: string;
  /** The mode that owns the item and where it is resolved. */
  readonly mode: AppModeId;
  /** Short, plain words, shown as the row title. */
  readonly title: string;
  /** Optional muted second line. */
  readonly detail?: string;
  /**
   * When it is due: a Perth calendar date `YYYY-MM-DD`, or an ISO instant with
   * a time. `null` for an item with no date (a count, a "not recorded" group).
   */
  readonly due: string | null;
  readonly severity: TodaySeverity;
  /** In-app path where the reader resolves the item. */
  readonly href: string;
}
