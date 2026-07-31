"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, type SelectHTMLAttributes, useId } from "react";
import { cn, fieldControl, fieldLabel, textMuted } from "@/components/ui-primitives";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> & {
  label: string;
  options: SelectOption[];
  hint?: ReactNode;
  error?: ReactNode;
  hideLabel?: boolean;
  /** Rendered as a disabled first option, so "nothing chosen" is a visible state. */
  placeholder?: string;
  fieldClassName?: string;
};

/**
 * A native `<select>` wearing the shared field shell.
 *
 * The reason this exists rather than a custom listbox: a `<select>` beside an
 * `<input>` in the same row was missing the inset well its siblings carried, so
 * two controls doing the same job read as different kinds of thing. The fix is
 * one shell for every control type — and the cheapest way to guarantee that is to
 * make the native element take the shell, rather than reimplementing keyboard
 * handling, mobile pickers and typeahead in a div.
 *
 * Reach for a combobox only when the list needs filtering. A 6-option select does
 * not.
 */
export function Select({
  label,
  options,
  hint,
  error,
  hideLabel,
  placeholder,
  className,
  fieldClassName,
  value,
  defaultValue,
  ...props
}: SelectProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("w-full", fieldClassName)}>
      <label htmlFor={id} className={cn(fieldLabel, hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <select
          {...props}
          id={id}
          value={value}
          defaultValue={defaultValue ?? (placeholder ? "" : undefined)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            fieldControl,
            // `appearance-none` + our own chevron, because the UA chevron cannot be
            // recoloured and looked foreign against the token palette in dark mode.
            "cursor-pointer appearance-none py-0 pl-3 pr-9",
            className,
          )}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-icon-md -translate-y-1/2 text-[color:var(--text-muted)]"
        />
      </div>
      {hint && !error ? (
        <p id={hintId} className={cn("mt-1.5 text-xs", textMuted)}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-semibold text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
