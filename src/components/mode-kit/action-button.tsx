"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { focusRing } from "@/components/card-recipes";
import { modeControlDisabled, modeControlShape, modeTapArea } from "@/components/mode-kit/recipes";
import { cn } from "@/components/ui-primitives";

type ModeActionButtonBase = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone?: keyof typeof modeControlShape;
  readonly testId?: string;
};

export type ModeActionButtonProps = ModeActionButtonBase &
  (
    | { readonly href: string; readonly onClick?: never; readonly disabled?: never }
    | { readonly onClick: () => void; readonly href?: never; readonly disabled?: boolean }
    | { readonly disabled: true; readonly href?: never; readonly onClick?: never }
  );

/**
 * A compact in-row control: a 34px visible shape at the 10px control radius,
 * inside a 48px tap area (standard §4: "32–36px inside 48px tap areas"). Icon
 * only, so `label` is its whole accessible name.
 *
 * `tone="command"` is the neutral command fill, allowed on controls up to 48px
 * (standard §10); the default is the quiet outlined shape. Never the mode colour.
 *
 * Every button does something (the wiring rule in AGENTS.md "Page and button
 * wiring"): the props require a destination (`href`), an action (`onClick`), or
 * an explicit `disabled` state, so an enabled button that does nothing cannot
 * be written.
 */
export function ModeActionButton({
  icon: Icon,
  label,
  onClick,
  href,
  tone = "neutral",
  disabled,
  testId,
}: ModeActionButtonProps) {
  const shape = (
    <span
      aria-hidden="true"
      className={cn(modeControlShape[tone], modeControlDisabled)}
      data-testid={testId ? `${testId}-shape` : undefined}
    >
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-icon-md" />
    </span>
  );
  const className = cn(modeTapArea, focusRing, "group rounded-md disabled:cursor-not-allowed");
  if (href) {
    return (
      <Link href={href} aria-label={label} className={className} data-testid={testId}>
        {shape}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-testid={testId}
    >
      {shape}
    </button>
  );
}

/** A labelled action with an optional neutral command fill and a 48px tap target.
 * Internal routes use Next Link; telephone and email links use ordinary anchors.
 */
export type ModeLabelledActionButtonProps = {
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly filled?: boolean;
  readonly className?: string;
} & ({ readonly href: string; readonly onClick?: never } | { readonly onClick: () => void; readonly href?: never });

const shape = {
  outlined:
    "border border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-heading)] active:bg-[color:var(--surface-wash)]",
  filled: "border border-transparent bg-[color:var(--command)] text-[color:var(--command-contrast)]",
} as const;

export function ModeLabelledActionButton({
  label,
  icon: Icon,
  filled = false,
  className,
  href,
  onClick,
}: ModeLabelledActionButtonProps) {
  const classes = cn(
    focusRing,
    "inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-md px-4 text-sm-minus font-medium",
    filled ? shape.filled : shape.outlined,
    className,
  );
  const body = (
    <>
      {Icon ? <Icon aria-hidden="true" strokeWidth={1.5} className="size-icon-md shrink-0" /> : null}
      {label}
    </>
  );
  if (href?.startsWith("/"))
    return (
      <Link href={href} className={classes} data-mode-filled={filled ? "" : undefined}>
        {body}
      </Link>
    );
  if (href) {
    return (
      <a href={href} className={classes} data-mode-filled={filled ? "" : undefined}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes} data-mode-filled={filled ? "" : undefined}>
      {body}
    </button>
  );
}
