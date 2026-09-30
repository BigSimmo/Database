"use client";

import Link from "next/link";
import { useState } from "react";

import { ChecklistStatus } from "@/components/admin/renewals/checklist-status";
import { requirementRowUrgency } from "@/components/admin/renewals/urgency";
import { focusRing } from "@/components/card-recipes";
import { InlineNotice } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn, controlDisabled, textMuted } from "@/components/ui-primitives";
import { formatRecordedDate } from "@/lib/admin/renewal-dates";
import { complianceExpiryHistory, issuerCheckStampLabel, renewalCalendarEvent } from "@/lib/admin/renewals";
import type { AdminRequirementCatalogueItem, RequirementChecklistRow } from "@/lib/admin/requirements";
import { downloadTextFile } from "@/lib/admin/download-file";
import { perthCalendarDate } from "@/lib/cme/cpd-year";
import { icsFileName, toIcs } from "@/lib/calendar/ics";
import { complianceExpiresOn, complianceIssuerCheckedOn, entryNotForThisJob } from "@/lib/on-call/compliance";
import type { OnCallEntry } from "@/lib/on-call/entry-model";

export type ChecklistItemSubject =
  | { readonly kind: "catalogue"; readonly item: AdminRequirementCatalogueItem; readonly entry: OnCallEntry | null }
  | { readonly kind: "personal"; readonly entry: OnCallEntry };

/**
 * The checklist item detail sheet (final design, screens-v3): the confirmed
 * rule or the unconfirmed line, the source, the recorded date and its
 * history, the holder-pressed issuer-check stamp, "Add to calendar",
 * "Renewed" at the foot, and a quiet "Not for this job" row. The stamp is a
 * holder action only — never "verified" or "compliant".
 */
export function ChecklistItemDetailSheet({
  subject,
  now,
  canEdit = true,
  onClose,
  onRenew,
  onNotForThisJob,
  onIssuerCheck,
  testId = "admin-renewals-item-sheet",
}: {
  readonly subject: ChecklistItemSubject | null;
  readonly now: Date;
  readonly canEdit?: boolean;
  readonly onClose: () => void;
  readonly onRenew: () => void;
  /** Catalogue items only; toggles "not for this job". `entry` is null for an
   *  item never recorded — the page then creates a minimal row to carry the flag
   *  (the design's "Visa and work rights — Not recorded yet — Not for this job"). */
  readonly onNotForThisJob?: (
    item: AdminRequirementCatalogueItem,
    entry: OnCallEntry | null,
    notForThisJob: boolean,
  ) => Promise<void>;
  /** Explicit issuer-check stamp: set today's Perth date, or clear. Never auto-set by Renewed. */
  readonly onIssuerCheck?: (entry: OnCallEntry, checkedOn: string | null) => Promise<void>;
  readonly testId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = subject !== null;
  const item = subject?.kind === "catalogue" ? subject.item : undefined;
  const entry = subject?.entry ?? null;
  const expiresOn = entry ? complianceExpiresOn(entry) : undefined;
  const history = entry ? complianceExpiryHistory(entry) : [];
  const flagged = entry ? entryNotForThisJob(entry) : false;
  const issuerCheckedOn = entry ? complianceIssuerCheckedOn(entry) : undefined;
  const row: RequirementChecklistRow | null =
    subject?.kind === "catalogue"
      ? {
          item: subject.item,
          entry,
          expiresOn,
          state: !entry ? "not-recorded" : expiresOn ? "needs-action" : "no-end-date",
        }
      : null;

  async function toggleNotForThisJob() {
    if (!item || !onNotForThisJob) return;
    setBusy(true);
    setError(null);
    try {
      await onNotForThisJob(item, entry, !flagged);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  async function recordIssuerCheck() {
    if (!entry || !onIssuerCheck) return;
    setBusy(true);
    setError(null);
    try {
      await onIssuerCheck(entry, perthCalendarDate(now));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  async function clearIssuerCheck() {
    if (!entry || !onIssuerCheck) return;
    setBusy(true);
    setError(null);
    try {
      await onIssuerCheck(entry, null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  function addToCalendar() {
    if (!entry) return;
    const event = renewalCalendarEvent(entry, now);
    if (!event) return;
    downloadTextFile(toIcs([event]), icsFileName(entry.title), "text/calendar;charset=utf-8");
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item?.title ?? entry?.title ?? ""}
      description="Recorded by you — not confirmed with the issuing body."
      testId={testId}
      footer={
        canEdit ? (
          <div className="grid gap-2">
            {error ? <InlineNotice tone="neutral">{error}</InlineNotice> : null}
            <Button variant="primary" block onClick={onRenew} testId={`${testId}-renew`}>
              {entry ? "Renewed" : "Add date"}
            </Button>
          </div>
        ) : undefined
      }
    >
      {subject ? (
        <div className="grid gap-4">
          <div className="grid gap-3 rounded-lg border border-[color:var(--border)] p-3">
            {item ? (
              item.status === "confirmed" ? (
                <p className="text-sm leading-6 text-[color:var(--text)]">{item.rule}</p>
              ) : (
                <div className="grid gap-0.5">
                  <p className="text-sm font-medium text-[color:var(--text-heading)]">Check with your service</p>
                  <p className={cn(textMuted, "text-sm leading-6")}>{item.whatIsUnconfirmed}</p>
                </div>
              )
            ) : null}
            {item ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                  focusRing,
                  textMuted,
                  "inline-flex min-h-tap w-fit items-center text-xs underline-offset-2 hover:underline",
                )}
              >
                {`Source: ${item.sourceName} · Updated ${formatRecordedDate(item.updated)}`}
              </a>
            ) : null}
            {item && onNotForThisJob ? (
              <button
                type="button"
                onClick={() => void toggleNotForThisJob()}
                disabled={busy}
                data-testid={`${testId}-not-for-this-job`}
                className={cn(
                  focusRing,
                  controlDisabled,
                  "min-h-tap w-fit text-left text-sm text-[color:var(--text-muted)] underline-offset-2 hover:underline",
                )}
              >
                {flagged ? "Move back" : "Not for this job"}
              </button>
            ) : null}
            {/* Spec review 20: a plain link from the medical registration item to
                CPD's own year check. Navigation only — Admin reads no CPD data
                and this link never appears in "Copy for workforce" or the
                calendar file, which are both built from `own`/`entries`
                directly rather than from anything this sheet renders. */}
            {item?.id === "medical-registration-renewal" ? (
              <Link
                href="/cme/check"
                data-testid="admin-renewals-cpd-link"
                className={cn(
                  focusRing,
                  textMuted,
                  "inline-flex min-h-tap w-fit items-center text-sm underline-offset-2 hover:underline",
                )}
              >
                Open CPD year check
              </Link>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-lg border border-[color:var(--border)] p-3">
            <div className="flex items-start justify-between gap-3">
              <span className="grid gap-0.5">
                <span className="text-sm font-medium text-[color:var(--text-heading)]">Expiry date</span>
                {row ? <ChecklistStatus urgency={requirementRowUrgency(row, now)} testId={`${testId}-status`} /> : null}
              </span>
              {expiresOn ? (
                <span className="nums text-lg-minus text-[color:var(--text-heading)]">
                  {formatRecordedDate(expiresOn)}
                </span>
              ) : null}
            </div>
            {entry?.details &&
            typeof entry.details === "object" &&
            (entry.details as { proofNote?: unknown }).proofNote ? (
              <p className={cn(textMuted, "text-sm")}>
                Where your proof is
                <br />
                {String((entry.details as { proofNote?: unknown }).proofNote)}
              </p>
            ) : null}
            {history.length > 0 ? (
              <div className="grid gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-muted)]">History</p>
                {history.map((date) => (
                  <p key={date} className={cn(textMuted, "text-sm")}>
                    {`Recorded before: ${formatRecordedDate(date)}`}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          {entry ? (
            <div
              className="grid gap-2 rounded-lg border border-[color:var(--border)] p-3"
              data-testid={`${testId}-issuer-check`}
            >
              <p className="text-sm text-[color:var(--text)]" data-testid={`${testId}-issuer-check-label`}>
                {issuerCheckStampLabel(issuerCheckedOn)}
              </p>
              {canEdit && onIssuerCheck ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    busy={busy}
                    onClick={() => void recordIssuerCheck()}
                    testId={`${testId}-issuer-check-record`}
                  >
                    Record issuer check today
                  </Button>
                  {issuerCheckedOn ? (
                    <button
                      type="button"
                      onClick={() => void clearIssuerCheck()}
                      disabled={busy}
                      data-testid={`${testId}-issuer-check-clear`}
                      className={cn(
                        focusRing,
                        controlDisabled,
                        "min-h-tap px-2 text-sm text-[color:var(--text-muted)] underline-offset-2 hover:underline",
                      )}
                    >
                      Clear issuer check
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className={cn(textMuted, "text-sm")} data-testid={`${testId}-issuer-check-label`}>
              No issuer check recorded
            </p>
          )}

          {entry ? (
            <Button variant="secondary" onClick={addToCalendar} testId={`${testId}-calendar`}>
              Add to calendar
            </Button>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
