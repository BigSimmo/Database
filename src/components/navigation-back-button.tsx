"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn, floatingControl } from "@/components/ui-primitives";

type NavigationBackButtonProps = {
  label?: string;
  fallbackHref?: string;
  className?: string;
};

export function NavigationBackButton({ label = "Go back", fallbackHref = "/", className }: NavigationBackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
      aria-label={label}
      className={cn(
        floatingControl,
        "h-10 w-10 rounded-full p-0 text-[color:var(--text-muted)] sm:h-11 sm:w-11",
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}
