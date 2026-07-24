import { Skeleton, searchPageShell, searchPageContainer } from "@/components/ui-primitives";

export default function Loading() {
  return (
    <div className={searchPageShell} role="status" aria-label="Loading library">
      <div className={searchPageContainer}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-10 w-full max-w-sm" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Skeleton className="h-40 w-full rounded-xl" animationDelay="50ms" />
          <Skeleton className="h-40 w-full rounded-xl" animationDelay="100ms" />
          <Skeleton className="h-40 w-full rounded-xl" animationDelay="150ms" />
          <Skeleton className="h-40 w-full rounded-xl" animationDelay="200ms" />
        </div>
      </div>
      <span className="sr-only">Loading library</span>
    </div>
  );
}
