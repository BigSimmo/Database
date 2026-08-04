"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

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
 * Deterministic in-app back control. Always navigates to `fallbackHref` rather
 * than `history.back()`, so deep links / external referrers cannot eject the
 * user out of Clinical KB (same contract as form detail pages).
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
        router.push(fallbackHref);
      }}
      className={cn(floatingControl, "rounded-full text-[color:var(--text-muted)]", className)}
      iconClassName="h-5 w-5"
    />
  );
}
