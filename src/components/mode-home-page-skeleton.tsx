import { cn } from "@/components/ui-primitives";

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <span className={cn("block animate-pulse rounded-md bg-[color:var(--surface-subtle)]", className)} aria-hidden />
  );
}

export function ModeHomePageSkeleton() {
  return (
    <div
      className="mx-auto grid w-full max-w-3xl justify-items-center gap-4 px-4 py-8"
      role="status"
      aria-label="Loading"
    >
      <SkeletonBlock className="h-14 w-14 rounded-2xl sm:h-16 sm:w-16" />
      <div className="grid w-full justify-items-center gap-2">
        <SkeletonBlock className="h-8 w-2/3 max-w-sm" />
        <SkeletonBlock className="h-4 w-1/2 max-w-xs" />
      </div>
      <SkeletonBlock className="mt-2 h-12 w-full max-w-xl rounded-xl" />
      <div className="mt-4 grid w-full max-w-xl gap-3">
        <SkeletonBlock className="h-16 w-full rounded-lg" />
        <SkeletonBlock className="h-16 w-full rounded-lg" />
        <SkeletonBlock className="h-16 w-full rounded-lg" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function ModeHomeRouteLoading() {
  return (
    <div className="flex min-h-[50vh] items-start justify-center bg-[color:var(--background)] pt-8">
      <ModeHomePageSkeleton />
    </div>
  );
}

export function DocumentSearchPageSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[104rem] space-y-4 px-3 py-4 sm:px-5"
      role="status"
      aria-label="Loading documents"
    >
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-12 w-full max-w-2xl rounded-xl" />
      <div className="grid gap-3">
        <SkeletonBlock className="h-20 w-full rounded-lg" />
        <SkeletonBlock className="h-20 w-full rounded-lg" />
        <SkeletonBlock className="h-20 w-full rounded-lg" />
      </div>
      <span className="sr-only">Loading documents</span>
    </div>
  );
}

export function DocumentViewerPageSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col gap-4 px-4 py-4" role="status" aria-label="Loading document">
      <SkeletonBlock className="h-10 w-full max-w-lg" />
      <SkeletonBlock className="min-h-0 flex-1 rounded-lg" />
      <span className="sr-only">Loading document</span>
    </div>
  );
}
