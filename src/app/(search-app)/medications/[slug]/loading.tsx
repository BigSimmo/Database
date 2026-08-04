import { Skeleton, searchPageShell, searchPageContainer } from "@/components/ui-primitives";

export default function Loading() {
  return (
    <div className={searchPageShell} role="status" aria-label="Loading tools">
      <div className={searchPageContainer}>
        <Skeleton className="mb-6 h-10 w-1/3 max-w-sm" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full rounded-xl" animationDelay="50ms" />
          <Skeleton className="h-40 w-full rounded-xl" animationDelay="100ms" />
          <Skeleton className="h-40 w-full rounded-xl" animationDelay="150ms" />
          <Skeleton className="h-40 w-full rounded-xl" animationDelay="200ms" />
        </div>
      </div>
      <span className="sr-only">Loading tools</span>
    </div>
  );
}
