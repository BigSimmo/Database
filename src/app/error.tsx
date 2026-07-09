"use client";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      title="Something went wrong"
      description="An unexpected error occurred in the application shell. You can try to reset the current view or refresh the browser."
      logLabel="Unhandled runtime error captured by boundary:"
      showReload
      minHeightClass="min-h-screen"
    />
  );
}
