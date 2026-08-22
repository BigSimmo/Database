"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn, fieldLabel, textMuted } from "@/components/ui-primitives";

/**
 * COMPONENTS §4. TextField, SearchField, Select and the choice controls each
 * hand-rolled the field shell, and each inherited the same four defects: the
 * hint vanished when an error appeared, caller `aria-describedby` was
 * overwritten, ids could not be supplied, and required/optional/autocomplete had
 * no system. This is the one shell they fold onto in PR 7.
 *
 * The hint-on-error rule is the load-bearing one. Losing the format hint at
 * exactly the moment the user got the format wrong is not a cosmetic bug: the
 * user is now being told they are wrong with no remaining statement of what
 * right looks like.
 */

export type FormFieldRenderProps = {
  id: string;
  /** Merged: caller ids, then hint, then error. Never overwritten. */
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
  /**
   * Pass-through autocomplete guidance (SPEC §9.7). Present on the render props
   * — and not only on `FormFieldProps` — so the control the caller renders can
   * actually apply it; the COMPONENTS §4 draft omitted it from the render shape.
   */
  autoComplete: string | undefined;
};

export type FormFieldProps = {
  /** Required — no unlabeled control exists. */
  label: string;
  /** External id supported; generated otherwise. */
  id?: string;
  /** Marked in the label text, never colour alone. */
  required?: boolean;
  hint?: string;
  /** Presence implies invalid. */
  error?: string;
  autoComplete?: string;
  /** Caller ids — merged, never overwritten. */
  describedBy?: string;
  /**
   * Visually hide the label but keep it for assistive technology. Added when the
   * controls folded on (PR 13): `TextField`, `SearchField` and `Select` each
   * carried this on their own shell, and a search field whose label is redundant
   * beside a heading still needs the label to exist.
   */
  hideLabel?: boolean;
  children: (field: FormFieldRenderProps) => ReactNode;
  className?: string;
};

export type FieldHintProps = { id: string; children: string };

export function FieldHint({ id, children }: FieldHintProps) {
  return (
    <p id={id} data-testid="field-hint" className={cn("mt-1.5 text-xs", textMuted)}>
      {children}
    </p>
  );
}

export type FieldErrorProps = { id: string; children: string };

export function FieldError({ id, children }: FieldErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      data-testid="field-error"
      className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-[color:var(--danger)]"
    >
      {/* Text plus icon: an error carried by red alone is invisible in forced
          colours, in greyscale, and to a red-green colour-blind reader. */}
      <TriangleAlert aria-hidden="true" className="mt-px size-icon-xs shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function FormField({
  label,
  id,
  required = false,
  hint,
  error,
  autoComplete,
  describedBy,
  hideLabel = false,
  children,
  className,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const invalid = Boolean(error);

  // Order is caller, hint, error: the caller's own description frames the field,
  // the hint states the rule, and the error states how this attempt broke it.
  const mergedDescribedBy =
    [describedBy?.trim() || null, hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("w-full", className)}>
      <label htmlFor={fieldId} className={cn(fieldLabel, hideLabel && "sr-only")}>
        {label}
        {/* The requirement is in the label text, so it survives colour loss and
            is read as part of the accessible name.

            Only the requirement is marked. Marking both sides was the original
            shape and it made every ordinary field noisier for no information:
            in a two- or three-column clinical grid the patient panel's five
            numeric fields read "Age (years) (optional)", "Weight (kg)
            (optional)", and so on down the column, where the panel already
            states that the whole profile is optional. Marking required fields
            and leaving the rest unmarked is the ordinary convention and carries
            the same information, because "unmarked" now means exactly one
            thing. */}
        {required ? <span className={cn("ml-1 font-normal", textMuted)}>(required)</span> : null}
      </label>
      {children({ id: fieldId, describedBy: mergedDescribedBy, invalid, required, autoComplete })}
      {/* Both stay in the DOM when invalid — that is the defect this shell fixes. */}
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

export type ErrorSummaryProps = {
  /** System default wording. */
  heading?: string;
  errors: Array<{ fieldId: string; label: string; message: string }>;
  /**
   * Incremented by the caller on each failed submit. Field IDs and error count
   * alone do not change when the user re-submits the same invalid values, so
   * without this token the focus effect would skip the second failure.
   */
  attempt?: number;
  /**
   * Opt out of the self-focus, for a form that moves focus somewhere else on a
   * failed submit. Additive and default-on, so every existing caller keeps the
   * behaviour it already had.
   *
   * A form must have exactly one focus owner. Two owners is not belt-and-braces:
   * the summary takes focus, a parent effect then moves focus to a field, and a
   * screen reader starts reading the summary and is cut off mid-sentence. Pass
   * `false` only when the caller genuinely owns the move — and then it must
   * actually make one, or a failed submit announces nothing at all.
   */
  manageFocus?: boolean;
  className?: string;
};

/**
 * Rendered at the top of a form after a failed submit. It takes focus rather
 * than announcing: moving focus is both the announcement and the navigation, so
 * a screen-reader user is not told about errors they then have to hunt for.
 * Deliberately not a live region — a live region plus a focus move reads twice.
 *
 * `manageFocus={false}` hands that job to the caller; the markup is unchanged.
 */
export function ErrorSummary({
  heading = "This form could not be submitted",
  errors,
  attempt = 0,
  manageFocus = true,
  className,
}: ErrorSummaryProps) {
  const container = useRef<HTMLDivElement>(null);
  const headingId = `${useId()}-error-summary-heading`;
  const errorKey = errors.map((entry) => entry.fieldId).join("|");

  useEffect(() => {
    if (manageFocus && errors.length > 0) container.current?.focus();
    // Re-focus when the error set changes *or* the caller reports another failed
    // submit with the same errors — a second failure deserves the same handling.
  }, [errorKey, errors.length, attempt, manageFocus]);

  if (errors.length === 0) return null;

  return (
    <div
      ref={container}
      tabIndex={-1}
      role="group"
      aria-labelledby={headingId}
      data-testid="error-summary"
      className={cn(
        "rounded-[var(--radius-md)] border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] p-[var(--pad-card)] text-sm text-[color:var(--danger)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
        className,
      )}
    >
      <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold">
        <TriangleAlert aria-hidden="true" className="size-icon-sm shrink-0" />
        {heading}
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {errors.map((entry) => (
          <li key={entry.fieldId}>
            <a
              href={`#${entry.fieldId}`}
              data-testid="error-summary-link"
              onClick={(event) => {
                const field = document.getElementById(entry.fieldId);
                if (!field) return;
                // Focus, not just scroll: the anchor jump alone leaves the caret
                // where it was and the next Tab resumes from the wrong place.
                event.preventDefault();
                field.focus();
              }}
              className="underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              {entry.label}: {entry.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
