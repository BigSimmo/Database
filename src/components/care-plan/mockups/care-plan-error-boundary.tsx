"use client";

import { Component, type ReactNode } from "react";

import { RouteErrorBoundary } from "@/components/route-error-boundary";

type CarePlanErrorBoundaryProps = { children: ReactNode };
type CarePlanErrorBoundaryState = { error: (Error & { digest?: string }) | null };

/**
 * Catches a broken invariant before it can blank the whole prototype.
 *
 * The reducer deliberately throws when a Management Plan has two versions
 * recorded as Current: a plan whose "use this one now" answer is ambiguous is
 * worse than no plan at all, so it must not render. That throw happens during the
 * render phase of the component that owns the state — the prototype provider —
 * and the provider is mounted in the route-family layout, which is why a Next.js
 * segment `error.tsx` cannot catch it: a segment's error file never catches a
 * throw from its own layout. The boundary therefore has to be an ancestor of the
 * provider (and a descendant of the developer gate, so an unauthorised visitor
 * still meets the gate rather than an error panel).
 *
 * The fallback is the repository's shared recovery panel rather than new markup,
 * so a Care Plan failure looks and behaves like every other route failure.
 */
export class CarePlanErrorBoundary extends Component<CarePlanErrorBoundaryProps, CarePlanErrorBoundaryState> {
  state: CarePlanErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error & { digest?: string }): CarePlanErrorBoundaryState {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <RouteErrorBoundary
        error={error}
        reset={() => this.setState({ error: null })}
        title="Care Plan could not be displayed"
        description="The synthetic prototype stopped because a record broke a rule it must never break. Nothing was saved, and trying again starts this page over."
        logLabel="Care Plan prototype invariant failure:"
        showReload
      />
    );
  }
}
