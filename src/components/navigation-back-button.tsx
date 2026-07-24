"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn, floatingControl, IconButton } from "@/components/ui-primitives";

type NavigationBackButtonProps = {
  label?: string;
  fallbackHref?: string;
  className?: string;
};

export function NavigationBackButton({ label = "Go back", fallbackHref = "/", className }: NavigationBackButtonProps) {
  const router = useRouter();

  return (
    <IconButton
      label={label}
      icon={ArrowLeft}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
      className={cn(floatingControl, "rounded-full text-[color:var(--text-muted)]", className)}
      iconClassName="h-5 w-5"
    />
  );
}
