"use client";

import { ChevronDown } from "lucide-react";
import type { Ref, SelectHTMLAttributes } from "react";

import { FormField } from "@/components/ui/form-field";
import { cn, fieldControl } from "@/components/ui-primitives";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> & {
  label: string;
  options: SelectOption[];
  /** External id supported; `FormField` generates one otherwise. */
  id?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  /** Rendered as a disabled first option, so "nothing chosen" is a visible state. */
  placeholder?: string;
  fieldClassName?: string;
  ref?: Ref<HTMLSelectElement>;
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
 * Folded onto `FormField` in PR 13, so "one shell" is now literal rather than a
 * third copy of the same markup — and the hint survives an error here too.
 *
 * Reach for a combobox only when the list needs filtering. A 6-option select does
 * not.
 */
export function Select({
  label,
  options,
  id,
  hint,
  error,
  hideLabel,
  placeholder,
  className,
  fieldClassName,
  value,
  defaultValue,
  required,
  autoComplete,
  "aria-describedby": callerDescribedBy,
  ...props
}: SelectProps) {
  return (
    <FormField
      label={label}
      id={id}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      required={required}
      autoComplete={autoComplete}
      describedBy={callerDescribedBy}
      className={fieldClassName}
    >
      {(field) => (
        <div className="relative">
          <select
            {...props}
            id={field.id}
            value={value}
            defaultValue={defaultValue ?? (placeholder ? "" : undefined)}
            required={field.required}
            autoComplete={field.autoComplete}
            aria-invalid={field.invalid || undefined}
            aria-describedby={field.describedBy}
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
      )}
    </FormField>
  );
}
