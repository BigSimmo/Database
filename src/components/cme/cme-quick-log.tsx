"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CmeEntryForm, type CmeEntryDraft } from "@/components/cme/cme-entry-form";
import { CME_NEW_ENTRY_DRAFT_KEY } from "@/components/cme/cme-new-entry-route";
import { Sheet } from "@/components/ui/sheet";
import { cn, InlineNotice, primaryControl, textMuted } from "@/components/ui-primitives";
import type { CmeRequirementSet } from "@/lib/cme/types";

/** How long "Saved to your log" stays on screen after a quick log. */
const SAVED_NOTICE_MS = 5000;

async function quickLogSaveError(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object") {
      const { message, error } = payload as { message?: unknown; error?: unknown };
      if (typeof message === "string" && message.trim()) return message;
      if (typeof error === "string" && error.trim()) return error;
    }
  } catch {
    // Not JSON. Fall through to the status line.
  }
  return `Could not save this entry (${response.status}).`;
}

/**
 * The "+ Log" button and the panel it opens: the quickest way to record an
 * activity from wherever the owner already is in CME.
 *
 * The panel is the same `CmeEntryForm` as the full new-entry page — the same
 * validation, the same single-category shortcut, the same draft kept for the
 * tab — so the two can never disagree about what a valid entry is. It saves
 * with one POST to `/api/cme/entries`, closes, refreshes the page underneath
 * so totals move at once, and says "Saved to your log".
 *
 * The button is fixed bottom-right, clear of the phone's home indicator. CME
 * pages have no bottom search dock, so it never sits on top of a composer.
 */
export function CmeQuickLog({ set, demoMode = false }: { set: CmeRequirementSet; demoMode?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [savedNotice, setSavedNotice] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const domains = set.requirements.flatMap((requirement) =>
    requirement.spec.shape === "activity-count" ? [...requirement.spec.buckets] : [],
  );
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Perth" });
  const initialDate = today.startsWith(`${set.year}-`) ? today : `${set.year}-01-01`;

  useEffect(() => {
    if (!savedNotice) return;
    const timer = window.setTimeout(() => setSavedNotice(false), SAVED_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [savedNotice]);

  async function saveEntry(entry: CmeEntryDraft) {
    if (demoMode) throw new Error("Demo mode is read-only. Sign in to save this activity to a private CME record.");
    const response = await fetch("/api/cme/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, requestId }),
    });
    if (!response.ok) throw new Error(await quickLogSaveError(response));
    setOpen(false);
    setSavedNotice(true);
    // A fresh request id per saved entry: the API treats a repeated id as the
    // same save, which is what protects a double tap, not a second activity.
    setRequestId(crypto.randomUUID());
    setFormKey((key) => key + 1);
    router.refresh();
  }

  return (
    <>
      <div
        role="status"
        data-testid="cme-quick-log-saved"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-toast)] flex justify-center px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+4rem)]"
      >
        {savedNotice ? (
          <p className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface-raised)] px-4 text-sm font-semibold text-[color:var(--clinical-accent)] shadow-[var(--shadow-elevated)]">
            <Check aria-hidden="true" className="size-icon-sm" />
            Saved to your log.
          </p>
        ) : null}
      </div>

      <button
        ref={buttonRef}
        type="button"
        data-testid="cme-quick-log-button"
        onClick={() => setOpen(true)}
        className={cn(
          primaryControl,
          "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[var(--z-chrome)] rounded-full shadow-[var(--shadow-elevated)] print:hidden",
        )}
      >
        <Plus aria-hidden="true" className="size-icon-sm" />
        Log
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Log an activity"
        mobilePlacement="bottom"
        returnFocusRef={buttonRef}
        testId="cme-quick-log-sheet"
      >
        <div className="flex flex-col gap-4 pb-2">
          {demoMode ? (
            <InlineNotice tone="neutral">
              Demo mode lets you try the form. Saving is available only in your signed-in private record.
            </InlineNotice>
          ) : null}
          <CmeEntryForm
            key={formKey}
            onSubmit={saveEntry}
            initialEntry={{
              date: initialDate,
              title: "",
              sourceUrl: null,
              allocations: [],
              reflection: "",
              costCents: null,
              routineId: null,
              documentId: null,
              buckets: [],
              formalPeerReviewHours: 0,
            }}
            availableDomains={domains}
            draftStorageKey={CME_NEW_ENTRY_DRAFT_KEY}
            stickySave={false}
          />
          <p className={cn(textMuted, "text-center text-xs")}>
            Prefer more room?{" "}
            <Link
              href={`/cme/new?year=${set.year}`}
              data-cme-keeps-draft=""
              className="inline-flex min-h-tap items-center font-semibold text-[color:var(--clinical-accent)] underline underline-offset-2"
            >
              Open the full page
            </Link>{" "}
            — anything typed here comes with you.
          </p>
        </div>
      </Sheet>
    </>
  );
}
