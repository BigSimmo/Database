import type { SessionDetail, SessionSummary, TeamSummary } from "@/lib/teaching/model";

/*
 * Fields the UI reads before parts 1 and 2 send them (contract additions D2 and
 * F1). Every one is optional at the summary level, and every screen renders
 * correctly without it: no struck-through old time, no "My level" segment.
 *
 * The real model (part 2's S1) already carries `previousStartsAt`,
 * `myAttendance`, `visitor`, `inCalendar`, `seriesId` and the widened `counts`
 * shape directly on `SessionDetail`, so `SessionDetailRead` only widens
 * `SessionSummary` with the two fields the detail type does not add on its
 * own: `forMyLevel` (F1, not sent by any part yet) is available wherever a
 * `SessionSummaryRead` is; `previousStartsAt` on `SessionDetail` and this type
 * unify to the same optional `string | null`, so no conflict. When a part adds
 * `forMyLevel` to the model, delete it here.
 */
export type SessionSummaryRead = SessionSummary & {
  /** D2: a moved session's old start, for the struck-through time. */
  previousStartsAt?: string | null;
  /** F1: this session is for the reader's level (What's on's "My level" segment). */
  forMyLevel?: boolean;
};

export type SessionDetailRead = SessionDetail & SessionSummaryRead;

/** D4: whether this service is in the reader's calendar feed. Settled directly on `TeamSummary`'s sibling, `SessionDetail.inCalendar`, for a session; this is for the team-level bar. */
export type TeamSummaryRead = TeamSummary & { inCalendar?: boolean };
