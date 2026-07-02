"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn, controlBase, floatingControl, primaryControl } from "@/components/ui-primitives";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  primary: cn(primaryControl, "px-4"),
  secondary: cn(floatingControl, "px-4"),
  ghost: cn(
    controlBase,
    "px-3 text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
  ),
  danger: cn(
    controlBase,
    "border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 text-[color:var(--danger)] hover:border-[color:var(--danger)]",
  ),
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 text-xs",
  md: "",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, leadingIcon, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leadingIcon}
      {children}
    </button>
  );
});
