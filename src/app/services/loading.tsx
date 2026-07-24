import { Skeleton, searchPageShell, searchPageContainer } from "@/components/ui-primitives";

export default function Loading() {
  return (
    <div className={searchPageShell} role="status" aria-label="Loading services">
      <div className={searchPageContainer}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 w-full rounded-xl" animationDelay="50ms" />
          <Skeleton className="h-32 w-full rounded-xl" animationDelay="100ms" />
          <Skeleton className="h-32 w-full rounded-xl" animationDelay="150ms" />
          <Skeleton className="h-32 w-full rounded-xl" animationDelay="200ms" />
        </div>
      </div>
      <span className="sr-only">Loading services</span>
    </div>
  );
}
