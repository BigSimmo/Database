"use client";

import type { LucideIcon } from "lucide-react";
import { useCallback, useRef } from "react";

import { cn } from "@/components/ui-primitives";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
};

type AccessibleName = { label: string; ariaLabelledBy?: never } | { label?: never; ariaLabelledBy: string };

export type SegmentedControlProps<T extends string> = AccessibleName & {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedControlOption<T>>;
  ariaDescribedBy?: string;
  layout?: "fit" | "equal";
  className?: string;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  ariaLabelledBy,
  ariaDescribedBy,
  layout = "fit",
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const enabled = options.filter((option) => !option.disabled);
  // Keep the controlled value honest: a disabled matching option stays the
  // checked radio. Never silently remap to the first enabled option — that
  // would show a selection the owner state does not hold.
  const valueMatchesOption = options.some((option) => option.value === value);
  const valueIsEnabled = enabled.some((option) => option.value === value);
  const selectedValue = valueMatchesOption ? value : undefined;
  const tabStopValue = valueIsEnabled ? value : enabled[0]?.value;

  const selectAndFocus = useCallback(
    (next: SegmentedControlOption<T> | undefined) => {
      if (!next || next.disabled) return;
      onChange(next.value);
      refs.current.get(next.value)?.focus();
    },
    [onChange],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!enabled.length) return;
      const currentValue = (event.target as HTMLElement).dataset.segmentValue as T | undefined;
      const current = Math.max(
        enabled.findIndex((option) => option.value === currentValue),
        0,
      );
      let next: number | null = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % enabled.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
        next = (current - 1 + enabled.length) % enabled.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = enabled.length - 1;
      if (next == null) return;
      event.preventDefault();
      selectAndFocus(enabled[next]);
    },
    [enabled, selectAndFocus],
  );

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      onKeyDown={onKeyDown}
      data-layout={layout}
      className={cn(
        "flex w-full min-w-0 gap-1 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-1 shadow-[var(--shadow-inset)]",
        layout === "equal" ? "flex-nowrap" : "flex-wrap",
        className,
      )}
    >
      {options.map((option) => {
        const checked = option.value === selectedValue;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={option.value === tabStopValue ? 0 : -1}
            disabled={option.disabled}
            data-segment-value={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-tap min-w-0 items-center justify-center whitespace-nowrap rounded-full font-semibold leading-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:text-[color:var(--disabled)]",
              layout === "equal"
                ? "flex-1 gap-1 px-0 text-3xs tracking-tight min-[360px]:px-1 min-[360px]:text-xs sm:gap-1.5 sm:px-3 sm:tracking-normal"
                : "flex-none gap-1.5 px-3 text-xs",
              checked
                ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--e1)] forced-colors:outline forced-colors:outline-2 forced-colors:[outline-color:Highlight]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text-heading)]",
            )}
          >
            {Icon ? <Icon aria-hidden="true" className="size-icon-sm shrink-0" /> : null}
            <span className="min-w-0 truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
