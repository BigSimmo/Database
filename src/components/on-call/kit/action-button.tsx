"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { focusRing } from "@/components/card-recipes";
import { onCallControlShape, onCallTapArea } from "@/components/on-call/kit/recipes";
import { cn } from "@/components/ui-primitives";

/**
 * A compact in-row control: a 34px visible shape at the 10px control radius,
 * inside a 48px tap area (standard §4: "32–36px inside 48px tap areas"). Icon
 * only, so `label` is its whole accessible name.
 *
 * `tone="command"` is the neutral command fill, allowed on controls up to 48px
 * (standard §10); the default is the quiet outlined shape. Never the mode colour.
 */
export function OnCallActionButton({
  icon: Icon,
  label,
  onClick,
  href,
  tone = "neutral",
  disabled,
  testId,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick?: () => void;
  readonly href?: string;
  readonly tone?: keyof typeof onCallControlShape;
  readonly disabled?: boolean;
  readonly testId?: string;
}) {
  const shape = (
    <span aria-hidden="true" className={onCallControlShape[tone]} data-testid={testId ? `${testId}-shape` : undefined}>
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-icon-md" />
    </span>
  );
  const className = cn(onCallTapArea, focusRing, "rounded-md disabled:opacity-50");
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
