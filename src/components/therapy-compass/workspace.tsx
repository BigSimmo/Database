"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ModeHomeVerificationFooter } from "@/components/mode-home-template";
import { cn, pageContainer } from "@/components/ui-primitives";

import { TcProvider, useTcBindings } from "./bindings";
import { accentControl, therapyBtn } from "./controls";
import { TherapyModeNav } from "./nav";

function TherapyCompassFooter() {
  return (
    <div data-therapy-no-print className={cn(pageContainer, "mt-[30px] border-t border-[color:var(--border)] pt-5")}>
      <ModeHomeVerificationFooter label="Decision support" body="Source-grounded — review status before clinical use" />
    </div>
  );
}

function TherapyCompassDataError() {
  const b = useTcBindings();
  return (
    <section
      role="alert"
      aria-live="assertive"
      aria-busy={b.loading}
      className="mx-auto my-10 max-w-2xl rounded-xl border border-[color:var(--danger)] bg-[color:var(--danger-soft)] p-6"
    >
      <h1 className="m-0 mb-2 text-xl text-[color:var(--text-heading)]">Therapy could not load</h1>
      <p className="m-0 mb-4 leading-normal text-[color:var(--text-muted)]">
        The therapy catalogue is unavailable. No results are being shown as a substitute.
      </p>
      <button
        type="button"
        className={`${therapyBtn} ${accentControl}`}
        onClick={b.retryData}
        // Native `disabled` alone: retry-while-loading is transient, not an
        // unavailability with a reason to announce, so the browser semantics are
        // the right ones. The `aria-disabled` that used to sit beside it changed
        // nothing — the native attribute wins on focus either way.
        disabled={b.loading}
      >
        {b.loading ? "Retrying…" : "Retry"}
      </button>
    </section>
  );
}

function TherapyCompassMain({
  children,
  showFooter,
  asMain,
}: {
  children: ReactNode;
  showFooter: boolean;
  /** Home renders ModeHomeMain; keep a non-main shell so landmarks are not nested. */
  asMain: boolean;
}) {
  const b = useTcBindings();
  // Home normally leaves <main> to ModeHomeMain. Initial loading and load
  // failure replace that child, so the workspace must own the landmark then.
  const homeNeedsMainLandmark = Boolean(b.error) || (b.loading && b.therapies.length === 0);
  const useMainLandmark = asMain || homeNeedsMainLandmark;
  const Tag = useMainLandmark ? "main" : "div";
  return (
    // Horizontal padding matches `--header-edge-pad` (1rem, 1.5rem from lg) so
    // the body's content edge lands on the same column as the header row and
    // the mode nav's first tab. The cap itself lives on the `<section>` inside,
    // reproducing the header's padding-outside-max-width geometry.
    <Tag className={useMainLandmark ? "min-w-0 px-4 pt-5 pb-8 sm:pt-8 sm:pb-10 lg:px-6" : "min-w-0"}>
      {b.error ? <TherapyCompassDataError /> : children}
      {showFooter ? <TherapyCompassFooter /> : null}
    </Tag>
  );
}

/** Shared Therapy workspace chrome for every `/therapy-compass/*` route. */
export function TherapyCompassWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/therapy-compass";

  return (
    <TcProvider>
      <div
        data-therapy-root
        className="min-h-0 bg-[color:var(--background)] text-[color:var(--text)] sm:min-h-[calc(100dvh-var(--shell-header-h))]"
      >
        {/* Every route but the mode home carries the shared bar, which pins
            itself inside the universal header's collapse track and so hides and
            reveals with it at every width. Home keeps none: `ModeHomeTemplate`
            already surfaces the same destinations as tiles, which is the
            convention every mode home follows. */}
        {isHome ? null : <TherapyModeNav />}
        <TherapyCompassMain showFooter={!isHome} asMain={!isHome}>
          {children}
        </TherapyCompassMain>
      </div>
    </TcProvider>
  );
}
