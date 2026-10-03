import { stableHash } from "@/lib/first-nations/approval";
import { formatDayMonthYear } from "@/lib/first-nations/contact-format";
import type { Approval } from "@/lib/first-nations/content-schema";

/**
 * The review facts a card can show, read from the content files only: the source's
 * title, and the approval record (body, role, date) when one matches the card's
 * current content. Nothing here is ever written by hand; a missing record is
 * shown as "Not yet reviewed".
 */
export type ReviewStamp = { source: string; reviewer: string | null; reviewedOn: string | null };

/** The first subject whose approval record still matches its content's hash wins (block, then its section). */
export function buildReviewStamp(
  sourceTitle: string,
  approvals: readonly Approval[],
  subjects: readonly { subjectId: string; content: unknown }[],
): ReviewStamp {
  for (const { subjectId, content } of subjects) {
    const record = approvals.find((a) => a.subjectId === subjectId);
    if (record && record.contentSha256 === stableHash(content)) {
      return { source: sourceTitle, reviewer: `${record.body}, ${record.role}`, reviewedOn: record.date };
    }
  }
  return { source: sourceTitle, reviewer: null, reviewedOn: null };
}

export function reviewStampText(stamp: ReviewStamp): string {
  const reviewed =
    stamp.reviewer && stamp.reviewedOn
      ? `Reviewed by ${stamp.reviewer} · ${formatDayMonthYear(stamp.reviewedOn)}`
      : "Not yet reviewed";
  return `Source: ${stamp.source} · ${reviewed}`;
}
