"use client";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      title="Failed to load Therapy Compass"
      description="An unexpected error occurred while loading the Therapy Compass module."
      logLabel="Unhandled runtime error captured in therapy-compass segment:"
      minHeightClass="min-h-[300px]"
    />
  );
}
