"use client";

import { useSyncExternalStore, type ReactNode } from "react";

function subscribeNoop() {
  return () => undefined;
}

/** Renders children only after the client has mounted to avoid SSR hydration
 *  mismatches when dev tooling injects attributes into the pre-hydration DOM. */
export function ClientHydrationBoundary({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const ready = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!ready) return fallback;
  return children;
}
