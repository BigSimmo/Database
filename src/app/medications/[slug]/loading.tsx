import { Skeleton } from "@/components/ui-primitives";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 lg:px-6" role="status" aria-label="Loading medication">
      <Skeleton className="mb-2 h-10 w-2/3 max-w-sm" />
      <Skeleton className="mb-6 h-6 w-1/3 max-w-xs" />

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>

      {/* Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 w-full rounded-xl" animationDelay="50ms" />
        <Skeleton className="h-48 w-full rounded-xl" animationDelay="100ms" />
        <Skeleton className="h-48 w-full rounded-xl" animationDelay="150ms" />
      </div>
      <span className="sr-only">Loading medication</span>
    </div>
  );
}
