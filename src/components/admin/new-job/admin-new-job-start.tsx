"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { cn, textMuted } from "@/components/ui-primitives";
import { formatDateEcho, formatRelativeDate } from "@/lib/admin/renewal-dates";
import { perthCalendarDate } from "@/lib/cme/cpd-year";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The line at the top of New job — "Starts Mon 2 Nov 2026 · in 5 weeks" — and
 * the one way to set or clear that date. There is no week strip (owner
 * decision): order, not weeks, is what the page shows below. The date field
 * starts blank and echoes what was typed, in words, before Save is enabled;
 * nothing is guessed.
 */
export function AdminNewJobStart({
  startsOn,
  now,
  canEdit,
  readOnlyReason = null,
  onSignIn,
  onSave,
  onClear,
}: {
  /** `YYYY-MM-DD`, or null when no start date is recorded. */
  startsOn: string | null;
  now: Date;
  /** False when there is no own row to attach the date to. */
  canEdit: boolean;
  /**
   * Why the date cannot be set, said beneath the start line: signed out (with
   * a sign-in control) or example records. Null says nothing — while loading,
   * after a failed load, or when there is no own row to hold the date.
   */
  readOnlyReason?: "signed-out" | "demo" | null;
  /** Opens the app's sign-in dialog; the signed-out reason offers it. */
  onSignIn?: () => void;
  onSave: (date: string) => Promise<boolean>;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const echo = DATE_KEY.test(draft) ? formatDateEcho(draft) : "";
  const today = perthCalendarDate(now);

  return (
    <div className="grid gap-1.5" data-testid="admin-new-job-start">
      <p className="text-sm text-[color:var(--text-heading)]" data-testid="admin-new-job-start-line">
        {startsOn ? (
          <>
            Starts {formatDateEcho(startsOn)}
            <span className={cn(textMuted, "text-sm")}>{` · ${formatRelativeDate(startsOn, today)}`}</span>
          </>
        ) : (
          <span className={textMuted}>No start date set</span>
        )}
      </p>
      {!canEdit && readOnlyReason === "signed-out" && onSignIn ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="admin-new-job-start-signed-out">
          <Button variant="secondary" size="sm" onClick={onSignIn} testId="admin-new-job-start-sign-in">
            Sign in to set your start date
          </Button>
        </div>
      ) : null}
      {!canEdit && readOnlyReason === "demo" ? (
        <p className={cn(textMuted, "text-xs")} data-testid="admin-new-job-start-demo">
          Example records are read-only
        </p>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <div data-testid="admin-new-job-start-input">
            <TextField
              label="Start date"
              hideLabel
              type="date"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              fieldClassName="max-w-48"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={!DATE_KEY.test(draft) || saving}
            onClick={async () => {
              setSaving(true);
              try {
                if (await onSave(draft)) setDraft("");
              } finally {
                setSaving(false);
              }
            }}
            testId="admin-new-job-start-save"
          >
            {startsOn ? "Change" : "Set start date"}
          </Button>
          {startsOn ? (
            <Button variant="secondary" size="sm" onClick={onClear} testId="admin-new-job-start-clear">
              Clear
            </Button>
          ) : null}
          {echo ? (
            <span className={cn(textMuted, "w-full text-xs")} data-testid="admin-new-job-start-echo">
              {echo}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
