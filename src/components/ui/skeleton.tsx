import { cn } from "@/components/ui-primitives";

/**
 * Shimmer placeholder used for content loads. Falls back to a static tinted
 * block under prefers-reduced-motion (the global media query zeroes the
 * animation). Decorative — always aria-hidden.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block rounded-md bg-[color:var(--surface-subtle)] bg-no-repeat",
        "bg-[length:200%_100%] bg-[linear-gradient(100deg,transparent_30%,color-mix(in_srgb,var(--surface-highlight)_72%,transparent)_50%,transparent_70%)]",
        "motion-safe:animate-shimmer",
        className,
      )}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span className={cn("block space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </span>
  );
}
