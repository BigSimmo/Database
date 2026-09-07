// src/components/caring-contacts/workspace/plan-status-toggle.tsx
"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export type PlanStatus = "active" | "inactive" | "paused" | "draft" | "completed" | "withdrawn" | "cancelled";

export type PlanStatusToggleProps = {
  planId: string;
  currentStatus: PlanStatus;
  onStatusChange: (newStatus: "active" | "inactive", reason?: string) => Promise<void> | void;
  patientName?: string | null;
  disabled?: boolean;
};

/**
 * Plan status toggle control with mandatory clinician safety confirmation dialog (#99W2X1).
 *
 * Suicide prevention plans must never be set to inactive casually or by an accidental click.
 * Transitioning an active plan to inactive triggers a modal barrier requiring explicit
 * confirmation and recording the clinical intent.
 */
export function PlanStatusToggle({
  planId,
  currentStatus,
  onStatusChange,
  patientName,
  disabled = false,
}: PlanStatusToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const titleId = useId();
  const descId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevIsOpenRef = useRef(false);

  const isActive = currentStatus === "active";

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    setReason("");
  }, []);

  // Handle escape key to dismiss confirmation dialog
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleCancel]);

  // Focus management: initial focus to Cancel on open, restore focus to trigger on close
  useEffect(() => {
    if (isOpen) {
      // Focus cancel button on open (clinician safety: do not default to destructive confirmation)
      cancelButtonRef.current?.focus();
    } else if (prevIsOpenRef.current) {
      // Restore focus to toggle switch button on dismiss
      toggleButtonRef.current?.focus();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // Trap focus inside modal when open
  const handleDialogKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !dialogRef.current) return;

    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const handleToggleClick = useCallback(async () => {
    if (disabled || isSubmitting) return;

    if (isActive) {
      // Clinician safety barrier: require explicit confirmation before setting active plan to inactive
      setIsOpen(true);
    } else {
      // Reactivating does not suspend care; proceed directly
      try {
        setIsSubmitting(true);
        await onStatusChange("active");
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [disabled, isActive, isSubmitting, onStatusChange]);

  const handleConfirmInactivation = useCallback(async () => {
    try {
      setIsSubmitting(true);
      await onStatusChange("inactive", reason.trim() || undefined);
      setIsOpen(false);
      setReason("");
    } finally {
      setIsSubmitting(false);
    }
  }, [onStatusChange, reason]);

  return (
    <div className="inline-flex items-center gap-2">
      <button
        ref={toggleButtonRef}
        type="button"
        role="switch"
        aria-checked={isActive}
        aria-label={`Plan status for ${patientName ?? planId}: currently ${isActive ? "Active" : "Inactive"}`}
        disabled={disabled || isSubmitting}
        onClick={handleToggleClick}
        data-testid="plan-status-toggle-button"
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus,#2563eb)] ${
          isActive ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
        } ${disabled || isSubmitting ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <span className="sr-only">Toggle plan status</span>
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isActive ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>

      <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted,#64748b)]">
        {isActive ? "Active" : "Inactive"}
      </span>

      {/* Confirmation Modal Barrier */}
      {isOpen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          onKeyDown={handleDialogKeyDown}
          data-testid="plan-inactivation-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-lg border border-[color:var(--border,#e2e8f0)] bg-[color:var(--surface,#ffffff)] p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <h3
                  id={titleId}
                  className="text-base font-semibold text-[color:var(--text-heading,#0f172a)] dark:text-white"
                >
                  Confirm Plan Deactivation
                </h3>
                <p id={descId} className="mt-2 text-sm text-[color:var(--text-muted,#64748b)] dark:text-slate-400">
                  You are about to transition {patientName ? <strong>{patientName}&rsquo;s</strong> : "this"} Caring
                  Contacts plan to <strong>Inactive</strong>. All scheduled suicide-prevention outreach and automated
                  messages will be suspended.
                </p>

                <div className="mt-4">
                  <label
                    htmlFor="inactivation-reason"
                    className="block text-xs font-medium text-[color:var(--text,#334155)] dark:text-slate-300"
                  >
                    Clinical Reason (optional)
                  </label>
                  <input
                    id="inactivation-reason"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleConfirmInactivation();
                      }
                    }}
                    placeholder="e.g., Readmission, patient opted out, care transferred"
                    className="mt-1 w-full rounded border border-[color:var(--border,#cbd5e1)] bg-[color:var(--surface,#ffffff)] px-3 py-1.5 text-sm text-[color:var(--text,#0f172a)] placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    ref={cancelButtonRef}
                    type="button"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    data-testid="cancel-inactivation-button"
                    className="rounded border border-[color:var(--border,#cbd5e1)] px-4 py-2 text-sm font-medium text-[color:var(--text,#334155)] hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmInactivation}
                    disabled={isSubmitting}
                    data-testid="confirm-inactivation-button"
                    className="inline-flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Deactivate Plan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
