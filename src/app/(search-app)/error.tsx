"use client";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

export default function SearchAppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      title="Something went wrong in this area"
      description="This section encountered an unexpected error. You can try to reset the current view or refresh the page."
      logLabel="Unhandled runtime error captured by search-app boundary:"
      showReload
      minHeightClass="min-h-screen"
    />
  );
}
