import * as React from "react"
import { cn } from "@/components/ui-primitives"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const baseStyles = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--focus)] focus:ring-offset-2 forced-colors:border";
  
  const variants = {
    default: "border-transparent bg-[color:var(--primary)] text-[color:var(--primary-contrast)] hover:bg-[color:var(--primary-strong)]",
    secondary: "border-transparent bg-[color:var(--surface-subtle)] text-[color:var(--text)] hover:bg-[color:var(--border)]",
    destructive: "border-transparent bg-[color:var(--danger)] text-[color:var(--danger-solid-contrast)] hover:bg-[color:var(--danger)]/80",
    outline: "text-[color:var(--text)] border-[color:var(--border-strong)]",
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  )
}

export { Badge }
