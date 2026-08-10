"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { navigateContextuallyBack } from "@/components/contextual-back-link";
import { cn, floatingControl, IconButton } from "@/components/ui-primitives";

type NavigationBackButtonProps = {
  label?: string;
  fallbackHref?: string;
  className?: string;
  /**
   * Optional gate before navigation. Return `false` to cancel (for example a
   * dirty-form confirmation). When omitted, navigation always proceeds.
   */
  onBeforeNavigate?: () => boolean;
};

/**
 * Browser-history back control with a deterministic fallback for a fresh tab.
 */
export function NavigationBackButton({
  label = "Go back",
  fallbackHref = "/",
  className,
  onBeforeNavigate,
}: NavigationBackButtonProps) {
  const router = useRouter();

  return (
    <IconButton
      label={label}
      icon={ArrowLeft}
      onClick={() => {
        if (onBeforeNavigate && !onBeforeNavigate()) return;
        navigateContextuallyBack(router, fallbackHref);
      }}
      className={cn(floatingControl, "rounded-full text-[color:var(--text-muted)]", className)}
      iconClassName="h-5 w-5"
    />
  );
}
