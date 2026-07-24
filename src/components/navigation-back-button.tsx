"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/components/ui-primitives";

type NavigationBackButtonProps = {
  label?: string;
  fallbackHref?: string;
  className?: string;
  onClick?: () => void;
};

type NavigationBackButtonControlProps = Pick<NavigationBackButtonProps, "className" | "label"> & {
  onClick: () => void;
};

function NavigationBackButtonControl({ label = "Go back", className, onClick }: NavigationBackButtonControlProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "universal-header-icon-control grid h-tap w-tap shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}

function RoutedNavigationBackButton({
  label,
  fallbackHref = "/",
  className,
}: Omit<NavigationBackButtonProps, "onClick">) {
  const router = useRouter();

  return (
    <NavigationBackButtonControl
      label={label}
      className={className}
      onClick={() => {
        router.push(fallbackHref);
      }}
    />
  );
}

export function NavigationBackButton({ onClick, ...props }: NavigationBackButtonProps) {
  return onClick ? (
    <NavigationBackButtonControl {...props} onClick={onClick} />
  ) : (
    <RoutedNavigationBackButton {...props} />
  );
}
