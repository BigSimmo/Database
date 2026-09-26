"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { CmeChoiceChip } from "@/components/cme/cme-choice-chip";
import { FieldError, FieldHint, FormField } from "@/components/ui/form-field";
import { cn, fieldControlPlain, fieldLabel } from "@/components/ui-primitives";
import { addCalendarDays, formatCmeDayInput, formatCmeRowDate, parseCmeDayInput } from "@/lib/cme/cpd-year";

export type CmeDateFieldProps = {
  readonly label: string;
  /** A Perth calendar date, `YYYY-MM-DD`, or "" for no date. */
  readonly value: string;
  /** Called with a `YYYY-MM-DD` date, or "" when the date is cleared. */
  readonly onChange: (iso: string) => void;
  /** Today's Perth calendar date, `YYYY-MM-DD` (`perthCalendarDate(...)`). */
  readonly today: string;
  readonly id?: string;
  /** Adds a hidden input carrying the `YYYY-MM-DD` value, for a form read through FormData. */
  readonly name?: string;
  readonly required?: boolean;
  readonly error?: string;
  /** False refuses a typed day after `today`. Default true. */
  readonly allowFuture?: boolean;
  /** False drops the Today / Yesterday / Other date chips and shows only the typed day. Default true. */
  readonly chips?: boolean;
  readonly hint?: string;
  readonly disabled?: boolean;
};

type Choice = "today" | "yesterday" | "other" | null;

/**
 * A CPD date: Today / Yesterday / Other date chips, then a typed
 * dd/mm/yyyy day for any other date — or, with `chips={false}`, only the typed
 * day. It replaces the browser's own date box, which many phones show in
 * the US month-first order.
 *
 * Values in and out are Perth calendar dates (`YYYY-MM-DD`), never instants.
 * A typed day is held as soon as it is complete; the box is checked, and
 * tidied to dd/mm/yyyy, when it loses focus or on Enter. A typo never becomes
 * a guessed date: on a `required` field an incomplete or unreadable day holds
 * no date, so the form's own check stops the save; on an optional field the
 * value already held is left as it was while the message shows. The keypad is
 * the decimal one, because the iPhone number pad has no "/" (and "." works).
 */
export function CmeDateField({
  label,
  value,
  onChange,
  today,
  id,
  name,
  required = false,
  error,
  allowFuture = true,
  chips = true,
  hint,
  disabled = false,
}: CmeDateFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `cme-date-${generatedId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const inputId = chips ? `${fieldId}-input` : fieldId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const yesterday = addCalendarDays(today, -1);
  const inputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState(() => formatCmeDayInput(value));
  const [syncedValue, setSyncedValue] = useState(value);
  const [otherOpen, setOtherOpen] = useState(false);
  const [typedError, setTypedError] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  // A value set from outside (a restored draft, "Start again") replaces what
  // is typed. Adjusted during render — React's pattern for state that follows
  // a prop — so the old text never shows for a frame.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(formatCmeDayInput(value));
    setOtherOpen(false);
    setTypedError(null);
  }

  useEffect(() => {
    if (focusRequest > 0) inputRef.current?.focus();
  }, [focusRequest]);

  function emit(next: string) {
    setSyncedValue(next);
    if (next !== value) onChange(next);
  }

  function choose(next: string) {
    setOtherOpen(false);
    setTypedError(null);
    setText(formatCmeDayInput(next));
    emit(next);
  }

  function openOther() {
    setOtherOpen(true);
    setTypedError(null);
    setFocusRequest((count) => count + 1);
  }

  function commit() {
    const trimmed = text.trim();
    const example = formatCmeDayInput(today);
    if (trimmed === "") {
      setTypedError(required ? `Enter a date, like ${example}.` : null);
      emit("");
      return;
    }
    const parsed = parseCmeDayInput(trimmed);
    const problem =
      parsed === null
        ? `Type day/month/year, like ${example} or ${example.replace(/\//g, "")}.`
        : !allowFuture && parsed > today
          ? "Choose today or an earlier day."
          : null;
    if (parsed === null || problem) {
      setTypedError(problem);
      if (required) emit("");
      return;
    }
    setTypedError(null);
    setText(formatCmeDayInput(parsed));
    emit(parsed);
  }

  const choice: Choice = !chips
    ? "other"
    : otherOpen
      ? "other"
      : value === ""
        ? null
        : value === today
          ? "today"
          : value === yesterday
            ? "yesterday"
            : "other";
  const shownError = typedError ?? error ?? null;
  const hiddenInput = name ? <input type="hidden" name={name} value={value} /> : null;

  const renderInput = (describedBy: string | undefined) => (
    <input
      ref={inputRef}
      id={inputId}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="dd/mm/yyyy"
      value={text}
      disabled={disabled}
      required={required}
      aria-invalid={shownError ? true : undefined}
      aria-describedby={describedBy}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        setOtherOpen(true);
        // Hold a typed day as soon as it is complete, so a Save tapped before the box loses
        // focus saves the day on screen. On a required field anything incomplete holds no date,
        // so an older date can never be saved by mistake; an optional field keeps its value
        // until the new day is complete (the draft row saves once per finished date).
        const parsed = parseCmeDayInput(next);
        if (parsed !== null && (allowFuture || parsed <= today)) {
          setTypedError(null);
          emit(parsed);
        } else if (required) {
          emit("");
        }
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
      className={cn(fieldControlPlain, "tabular-nums")}
    />
  );

  if (!chips) {
    return (
      <FormField label={label} id={inputId} required={required} hint={hint} error={shownError ?? undefined}>
        {(field) => (
          <>
            {renderInput(field.describedBy)}
            {hiddenInput}
          </>
        )}
      </FormField>
    );
  }

  const describedBy = [hint ? hintId : null, shownError ? errorId : null].filter(Boolean).join(" ") || undefined;
  const otherLabel =
    choice === "other" && value !== "" && value !== today && value !== yesterday
      ? formatCmeRowDate(value, today)
      : "Other date";

  return (
    <fieldset id={fieldId} data-testid={fieldId} aria-describedby={describedBy} disabled={disabled} className="min-w-0">
      <legend className={fieldLabel}>{label}</legend>
      <div className="flex flex-wrap gap-x-2">
        <CmeChoiceChip pressed={choice === "today"} onPress={() => choose(today)} testId={`${fieldId}-today`}>
          Today
        </CmeChoiceChip>
        <CmeChoiceChip
          pressed={choice === "yesterday"}
          onPress={() => choose(yesterday)}
          testId={`${fieldId}-yesterday`}
        >
          Yesterday
        </CmeChoiceChip>
        <CmeChoiceChip pressed={choice === "other"} onPress={openOther} icon={CalendarDays} testId={`${fieldId}-other`}>
          {otherLabel}
        </CmeChoiceChip>
      </div>
      {choice === "other" ? (
        <div className="mt-1">
          <label htmlFor={inputId} className="sr-only">
            {`${label}, day/month/year`}
          </label>
          {renderInput(describedBy)}
        </div>
      ) : null}
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {shownError ? <FieldError id={errorId}>{shownError}</FieldError> : null}
      {hiddenInput}
    </fieldset>
  );
}
