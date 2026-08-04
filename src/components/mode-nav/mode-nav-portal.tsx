"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { phoneHeaderCollapseAddonSlotId } from "@/lib/mode-home-composer";

/**
 * Moves a mode's navigation bar into the universal header's collapse track at
 * *every* width.
 *
 * This is a deliberate sibling of `PhoneHeaderCollapsePortal`, which resolves
 * the same host only below the phone breakpoint. That gate is why the Therapy
 * strip never travelled with the header on a tablet or desktop: it stayed in
 * page flow as `position: sticky; top: 0` instead.
 *
 * The header needs no change for this to work. Its addon slot is rendered with
 * no breakpoint prefix (`master-search-header.tsx`, `empty:hidden` inside
 * `universal-header-collapse`), and for the `GlobalSearchShell` host —
 * `{ strategy: "collapse", wide: "sticky" }` — the collapsing wrapper takes its
 * ungated `grid-template-rows: 1fr -> 0fr` branch at every width. Occupying the
 * slot from here therefore inherits the header's hide and reveal exactly, with
 * no second scroll listener that could drift out of step with it.
 *
 * Falls back to normal flow when no host exists — routes rendered without the
 * universal header, and the server pass — so navigation is never lost.
 *
 * Slot ownership: the addon slot holds ONE page-owned header. `DocumentViewer`
 * and the differentials detail page already claim it on phones, so a mode whose
 * routes include those pages must not also mount a bar there. `ModeNav` renders
 * nothing below two destinations, which is what keeps those modes clear today;
 * `tests/mode-nav-contract.test.ts` fails if that stops being true.
 */
export function ModeNavHeaderPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const sync = () => {
      const next = document.getElementById(phoneHeaderCollapseAddonSlotId);
      setHost((current) => (current === next ? current : next));
    };

    sync();
    // The shell remounts its header across mode switches, so the host element's
    // identity is not stable for this component's lifetime.
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return host ? createPortal(children, host) : children;
}
