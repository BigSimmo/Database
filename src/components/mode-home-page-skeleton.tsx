function SkeletonBlock({ className }: { className?: string }) {
  return (
    <span
      className={`block animate-skeleton-shimmer rounded-md bg-[color:var(--surface-subtle)]${className ? ` ${className}` : ""}`}
      aria-hidden
    />
  );
}

export function ModeHomePageSkeleton() {
  return (
    <div
      className="mx-auto grid w-full max-w-[60rem] justify-items-center gap-3.5 px-4 py-8 sm:gap-6"
      role="status"
      aria-label="Loading"
    >
      <SkeletonBlock className="h-tap w-tap rounded-2xl sm:h-12 sm:w-12 lg:h-14 lg:w-14" />
      <div className="grid w-full justify-items-center gap-2">
        <SkeletonBlock className="h-7 w-2/3 max-w-sm sm:h-9 lg:h-10" />
        <SkeletonBlock className="h-5 w-1/2 max-w-xs" />
      </div>
      <SkeletonBlock className="mt-2 h-14 w-full max-w-xl rounded-full" />
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
    <div className="grid min-h-[calc(100dvh-13.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] items-center justify-items-center bg-[color:var(--background)] sm:min-h-[calc(100dvh-var(--shell-header-h))]">
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
    <div
      className="flex h-[calc(100dvh-var(--shell-header-h))] flex-col gap-4 px-4 py-4"
      role="status"
      aria-label="Loading document"
    >
      <SkeletonBlock className="h-10 w-full max-w-lg" />
      <SkeletonBlock className="min-h-0 flex-1 rounded-lg" />
      <span className="sr-only">Loading document</span>
    </div>
  );
}
