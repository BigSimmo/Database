"use client";

import { Check } from "lucide-react";
import { type InputHTMLAttributes, type ReactNode, type Ref, useId } from "react";

import { FieldError, FieldHint } from "@/components/ui/form-field";
import { cn, textMuted } from "@/components/ui-primitives";

/*
 * Checkbox and radio, which the system was missing entirely — `ToggleSwitch` was
 * standing in for both, and it means something different.
 *
 *   Switch   — applies immediately. "Dark mode on."
 *   Checkbox — applies on submit, or contributes to a set. "Include outdated sources."
 *   Radio    — one of N, applies on submit. "Sort by relevance / date / publisher."
 *
 * Using a switch for a filter tells the user the filter has already run. In a
 * clinical search that is a claim about what they are currently looking at.
 *
 * Both controls keep the NATIVE input, visually hidden but focusable, with the
 * visible box driven from `peer-*` state. That buys real keyboard behaviour,
 * form participation, `:indeterminate`, and correct screen-reader roles for free.
 */

const boxBase =
  "grid size-[1.125rem] shrink-0 place-items-center rounded-xs border transition motion-reduce:transition-none";

/**
 * Option ids are derived from a sanitised key, never the raw value (COMPONENTS
 * §9.7). A radio value is domain data — `mg/dL`, `SSRI + lithium`, a UUID with a
 * colon — and dropping it straight into an id produces a fragment a CSS/DOM
 * selector cannot address and, when two values sanitise alike, a `htmlFor` that
 * silently points at the wrong input. The index keeps the result unique.
 */
function optionId(groupId: string, value: string, index: number): string {
  const slug = value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${groupId}-${index}${slug ? `-${slug}` : ""}`;
}

/** Caller ids first, then hint, then error — the same order `FormField` uses. */
function mergeDescribedBy(...ids: Array<string | null | undefined>): string | undefined {
  return ids.filter(Boolean).join(" ") || undefined;
}

const rowBase =
  "group flex min-h-tap w-full cursor-pointer items-start gap-3 rounded-md px-1 py-1.5 transition hover:bg-[color:var(--surface-subtle)] has-[:disabled]:cursor-not-allowed has-[:disabled]:hover:bg-transparent";

function Row({
  children,
  description,
  label,
  disabled,
  htmlFor,
  describedBy,
}: {
  children: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  htmlFor: string;
  describedBy?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={rowBase}>
      {children}
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm font-medium leading-5",
            disabled ? "text-[color:var(--disabled)]" : "text-[color:var(--text)]",
          )}
        >
          {label}
        </span>
        {description ? (
          <span id={describedBy} className={cn("mt-0.5 block text-xs leading-4", textMuted)}>
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & {
  label: ReactNode;
  description?: ReactNode;
  /** External id supported; generated otherwise. */
  id?: string;
  /** Mixed state for a parent controlling a partially-selected group. */
  indeterminate?: boolean;
  ref?: Ref<HTMLInputElement>;
};

export function Checkbox({
  label,
  description,
  id,
  indeterminate,
  disabled,
  className,
  ref,
  "aria-describedby": callerDescribedBy,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descId = description ? `${fieldId}-desc` : undefined;

  return (
    <Row label={label} description={description} disabled={disabled} htmlFor={fieldId} describedBy={descId}>
      <span className="relative mt-0.5 flex">
        <input
          {...props}
          id={fieldId}
          type="checkbox"
          disabled={disabled}
          // Merged, not overwritten: a caller describing the row from outside the
          // component used to lose that description the moment it passed one in.
          aria-describedby={mergeDescribedBy(callerDescribedBy, descId)}
          aria-checked={indeterminate ? "mixed" : undefined}
          // The component owns this ref to drive `indeterminate`, which has no
          // HTML attribute and can only be set on the node. A caller ref must
          // therefore be forwarded by hand: spreading it through `...props`
          // would be overwritten here, silently, while the prop type kept
          // promising it worked.
          ref={(node) => {
            if (node) node.indeterminate = Boolean(indeterminate);
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-xs disabled:cursor-not-allowed"
        />
        <span
          aria-hidden
          className={cn(
            boxBase,
            "border-[color:var(--border-strong)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]",
            "peer-checked:border-[color:var(--command)] peer-checked:bg-[color:var(--command)] peer-checked:text-[color:var(--command-contrast)]",
            "peer-indeterminate:border-[color:var(--command)] peer-indeterminate:bg-[color:var(--command)] peer-indeterminate:text-[color:var(--command-contrast)]",
            "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]",
            "peer-disabled:border-[color:var(--border)] peer-disabled:bg-[color:var(--surface-subtle)] peer-disabled:shadow-none",
            "forced-colors:border",
            className,
          )}
        >
          {indeterminate ? (
            <span className="h-[2px] w-2.5 rounded-full bg-current" />
          ) : (
            <Check aria-hidden="true" className="size-icon-xs opacity-0 peer-checked:opacity-100" strokeWidth={3} />
          )}
        </span>
      </span>
    </Row>
  );
}

export type RadioOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

export type RadioGroupProps = {
  /** Group label — rendered as the fieldset legend, which is what gets announced. */
  label: string;
  name: string;
  options: RadioOption[];
  /** External id supported; generated otherwise. Seeds every option id. */
  id?: string;
  /**
   * Group-level hint and error. A radio set's rule ("choose the jurisdiction the
   * guideline applies to") belongs to the group, not to one option, and it stays
   * in the DOM when the error appears — the same rule `FormField` enforces for
   * single controls, using the same two nodes.
   */
  hint?: string;
  error?: string;
  /** Caller ids — merged ahead of the hint, never overwritten. */
  describedBy?: string;
  hideLabel?: boolean;
  className?: string;
} & (
  | {
      /** Controlled mode — value and onChange travel together. */
      value: string;
      onChange: (value: string) => void;
      defaultValue?: never;
    }
  | {
      /** Uncontrolled mode — native radio state, optional initial value. */
      value?: never;
      onChange?: never;
      defaultValue?: string;
    }
);

/**
 * A real `<fieldset>` + `<legend>`. A radio set without one announces each option
 * with no idea what question it answers — "Relevance, radio button, 1 of 3" tells
 * a screen-reader user nothing about what is being sorted.
 *
 * The group keeps `<fieldset>`/`<legend>` rather than folding onto `FormField`'s
 * `<label htmlFor>`: a label pointing at a fieldset names nothing, and the legend
 * is what actually gets announced with each option. What it does take from the
 * shell is the part that was missing — `FieldHint` and `FieldError`, both present
 * at once when invalid, both in the group's `aria-describedby`.
 */
export function RadioGroup({
  label,
  name,
  options,
  value,
  onChange,
  defaultValue,
  id,
  hint,
  error,
  describedBy,
  hideLabel,
  className,
}: RadioGroupProps) {
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const hintId = `${groupId}-hint`;
  const errorId = `${groupId}-error`;
  const invalid = Boolean(error);
  const controlled = value !== undefined;

  return (
    <fieldset
      id={groupId}
      className={cn("min-w-0 border-0 p-0", className)}
      aria-invalid={invalid || undefined}
      aria-describedby={mergeDescribedBy(describedBy?.trim(), hint ? hintId : null, invalid ? errorId : null)}
    >
      <legend className={cn("mb-1.5 text-sm font-medium text-[color:var(--text)]", hideLabel && "sr-only")}>
        {label}
      </legend>
      <div className="flex flex-col gap-0.5">
        {options.map((option, index) => {
          const inputId = optionId(groupId, option.value, index);
          const descId = option.description ? `${inputId}-desc` : undefined;
          return (
            <Row
              key={option.value}
              label={option.label}
              description={option.description}
              disabled={option.disabled}
              htmlFor={inputId}
              describedBy={descId}
            >
              <span className="relative mt-0.5 flex">
                <input
                  id={inputId}
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={controlled ? value === option.value : undefined}
                  defaultChecked={!controlled ? defaultValue === option.value : undefined}
                  disabled={option.disabled}
                  aria-describedby={descId}
                  onChange={controlled ? () => onChange(option.value) : undefined}
                  className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed"
                />
                <span
                  aria-hidden
                  className={cn(
                    boxBase,
                    "rounded-full border-[color:var(--border-strong)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]",
                    "peer-checked:border-[color:var(--command)]",
                    "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]",
                    "peer-disabled:border-[color:var(--border)] peer-disabled:bg-[color:var(--surface-subtle)] peer-disabled:shadow-none",
                    "forced-colors:border",
                  )}
                >
                  <span className="size-2 rounded-full bg-[color:var(--command)] opacity-0 peer-checked:opacity-100" />
                </span>
              </span>
            </Row>
          );
        })}
      </div>
      {/* Both stay in the DOM when invalid — the same rule as the single-control shell. */}
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </fieldset>
  );
}
