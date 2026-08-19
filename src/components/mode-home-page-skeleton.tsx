import { Skeleton } from "@/components/ui-primitives";

export function ModeHomePageSkeleton() {
  return (
    <div
      className="mx-auto grid w-full max-w-[60rem] justify-items-center gap-4 px-4 py-8 sm:gap-6 animate-fade-in motion-reduce:animate-none"
      role="status"
      aria-label="Loading"
    >
      {/* Mirrors ModeHomeHero: same medallion token, same copy gap, so the
          skeleton does not resize the hero when the real content mounts. */}
      <Skeleton className="size-hero-medallion rounded-2xl" />
      <div className="grid w-full justify-items-center gap-1 sm:gap-1.5">
        <Skeleton className="h-7 w-2/3 max-w-sm sm:h-9 lg:h-10" />
        <Skeleton className="h-5 w-1/2 max-w-xs" />
      </div>
      <Skeleton className="mt-2 h-14 w-full max-w-xl rounded-full" />
      <div className="mt-4 grid w-full max-w-xl gap-3">
        <Skeleton className="h-16 w-full rounded-lg" animationDelay="50ms" />
        <Skeleton className="h-16 w-full rounded-lg" animationDelay="100ms" />
        <Skeleton className="h-16 w-full rounded-lg" animationDelay="150ms" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function ModeHomeRouteLoading() {
  return (
    // Match ModeHomeMain startOnPhone: top-align on phones, centre from sm up.
    // A phone-centred skeleton jumped when content-rich homes mounted top-aligned.
    <div className="grid min-h-[calc(100dvh-var(--shell-header-h))] items-start justify-items-center bg-[color:var(--background)] pt-3 sm:items-center sm:pt-0">
      <ModeHomePageSkeleton />
    </div>
  );
}

export function DocumentSearchPageSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[104rem] space-y-4 px-3 py-4 sm:px-5 animate-fade-in motion-reduce:animate-none"
      role="status"
      aria-label="Loading documents"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-12 w-full max-w-2xl rounded-xl" />
      <div className="grid gap-3">
        <Skeleton className="h-20 w-full rounded-lg" animationDelay="50ms" />
        <Skeleton className="h-20 w-full rounded-lg" animationDelay="100ms" />
        <Skeleton className="h-20 w-full rounded-lg" animationDelay="150ms" />
      </div>
      <span className="sr-only">Loading documents</span>
    </div>
  );
}

export function DocumentViewerPageSkeleton() {
  return (
    <div
      className="flex h-[calc(100dvh-var(--shell-header-h))] flex-col gap-4 px-4 py-4 animate-fade-in motion-reduce:animate-none"
      role="status"
      aria-label="Loading document"
    >
      <Skeleton className="h-10 w-full max-w-lg" />
      <Skeleton className="min-h-0 flex-1 rounded-lg" />
      <span className="sr-only">Loading document</span>
    </div>
  );
}
