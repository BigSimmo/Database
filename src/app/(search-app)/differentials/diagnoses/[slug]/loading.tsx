import {
  Skeleton,
  searchPageShell,
  searchPageContainer,
  searchResultsBodyGrid,
  searchResultsMainColumn,
  searchResultsSidebar,
} from "@/components/ui-primitives";

export default function Loading() {
  return (
    <div className={searchPageShell} role="status" aria-label="Loading differentials">
      <div className={searchPageContainer}>
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-10 w-1/3 max-w-sm" />
          <Skeleton className="h-10 w-24" />
        </div>

        <div className={searchResultsBodyGrid}>
          <div className={searchResultsMainColumn}>
            <div className="grid gap-4">
              <Skeleton className="h-32 w-full rounded-xl" animationDelay="50ms" />
              <Skeleton className="h-32 w-full rounded-xl" animationDelay="100ms" />
              <Skeleton className="h-32 w-full rounded-xl" animationDelay="150ms" />
            </div>
          </div>
          <div className={searchResultsSidebar}>
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading differentials</span>
    </div>
  );
}
