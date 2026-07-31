"use client";

import { Search, X, type LucideIcon } from "lucide-react";
import { type InputHTMLAttributes, type ReactNode, useId } from "react";
import {
  cn,
  fieldControlPlain,
  fieldControlWithIcon,
  fieldIcon,
  fieldLabel,
  textMuted,
} from "@/components/ui-primitives";

type FieldShellProps = {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  hintId: string;
  errorId: string;
  hideLabel?: boolean;
  children: ReactNode;
  className?: string;
};

// Hint and error are separate nodes with separate ids so `aria-describedby` can
// carry both — collapsing them into one string loses the hint the moment the
// field goes invalid, exactly when the user needs to re-read the format rule.
function FieldShell({ id, label, hint, error, hintId, errorId, hideLabel, children, className }: FieldShellProps) {
  return (
    <div className={cn("w-full", className)}>
      <label htmlFor={id} className={cn(fieldLabel, hideLabel && "sr-only")}>
        {label}
      </label>
      {children}
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

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  /** Visually hide the label but keep it for assistive technology. */
  hideLabel?: boolean;
  /** Leading glyph. Adds the inset padding the icon needs. */
  icon?: LucideIcon;
  /** Wrapper class; `className` still lands on the input itself. */
  fieldClassName?: string;
};

export function TextField({
  label,
  hint,
  error,
  hideLabel,
  icon: Icon,
  className,
  fieldClassName,
  ...props
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      hintId={hintId}
      errorId={errorId}
      hideLabel={hideLabel}
      className={fieldClassName}
    >
      <div className="relative">
        {Icon ? <Icon aria-hidden="true" className={fieldIcon} /> : null}
        <input
          {...props}
          id={id}
          // `fieldControl` already styles `aria-[invalid=true]`; passing the flag
          // here is what makes that existing state reachable from a prop.
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(Icon ? fieldControlWithIcon : fieldControlPlain, className)}
        />
      </div>
    </FieldShell>
  );
}

export type SearchFieldProps = Omit<TextFieldProps, "icon" | "type"> & {
  /** Render a clear control once the field has a value. */
  onClear?: () => void;
  clearLabel?: string;
};

export function SearchField({
  label,
  hint,
  error,
  hideLabel = true,
  onClear,
  clearLabel = "Clear search",
  className,
  fieldClassName,
  value,
  ...props
}: SearchFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const showClear = Boolean(onClear && typeof value === "string" && value.length > 0);

  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      hintId={hintId}
      errorId={errorId}
      hideLabel={hideLabel}
      className={fieldClassName}
    >
      <div className="relative">
        <Search aria-hidden="true" className={fieldIcon} />
        <input
          {...props}
          id={id}
          type="search"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(fieldControlWithIcon, showClear && "pr-11", className)}
        />
        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label={clearLabel}
            className="absolute right-1 top-1/2 grid size-tap -translate-y-1/2 place-items-center rounded-lg text-[color:var(--text-muted)] transition hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            <X aria-hidden="true" className="size-icon-md" />
          </button>
        ) : null}
      </div>
    </FieldShell>
  );
}
