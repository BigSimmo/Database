// src/components/ward-management/ward-shell.tsx
"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { wardPlaceFor } from "@/components/ward-management/ward-place";

import styles from "./ward-shell.module.css";

/**
 * The ground Ward Flow's panels float on — mounted once, in
 * `src/app/mockups/ward-flow/layout.tsx`, rather than reinvented per screen
 * (docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md).
 *
 * Renders NO `<h1>` and NO `<main>`; it is a plain wrapper `<div>` so it can sit above every
 * route's own landmarks without adding one of its own. `layout.tsx` wraps `children` — the whole
 * of every route's output, `<main>` included — inside this component, so the ground is a real
 * ancestor of every route's content, not a sibling that merely happens to sit next to it. That
 * placement is the thing this component could not do on its own while it was bundled with the
 * header: `ClinicalRail`, which owns the header's phone-bar-era home, is a SIBLING of every
 * screen's `<main>` at all ~26 call sites, and no edit confined to it could ever change that.
 */
export function WardGround({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>{children}</div>;
}

/**
 * The place a route puts you in, rendered once per route as ordinary in-flow content.
 *
 * ⚠️ **Decision 3, amended 2026-09-04.** The original plan wanted this nested inside
 * `ClinicalRail`'s fixed phone bar below 40rem, to avoid becoming a second top-anchored phone
 * element. `.phoneBar` (`ward-sidebar.module.css`) turned out to be a tight, fully-occupied fixed
 * row (brand link + menu button) with no spare room for a second control, so the amendment
 * achieves the same goal a different way: on every viewport this header is ORDINARY IN-FLOW
 * CONTENT — never `position: fixed` or `sticky` — so it cannot become a second top-anchored
 * element regardless of where in the DOM it sits. This is the same treatment `.workspaceHeader`
 * now gets, so the two are consistent rather than differently special.
 * `tests/ward-chrome-owner.test.ts` is the guard that keeps this true.
 *
 * Takes NO props. It derives the place itself from the current route via `usePathname` and
 * `wardPlaceFor` — the one function a pathname resolves to a name through — rather than a caller
 * passing `place` down, which would mean `layout.tsx` doing route parsing that `ward-place.ts`
 * exists to own. It reads the provider's live `units` (`useWardFlow()`) to pass into
 * `wardPlaceFor`, the same live collection every other unit-resolving surface uses — never the
 * frozen `ward-sites.ts` fixture, which a scenario can have renamed or altered.
 *
 * ⚠️ Renders nothing at all when the route has no place (`wardPlaceFor` returns `undefined` on 7
 * of the 10 approved prototypes, and every route without one) — never a placeholder like "—" or
 * "All wards". See `ward-place.ts`'s own warning against inventing a scope a screen does not have.
 *
 * ⚠️ Carries NO role switcher. The original plan's Decision 1 said "the header carries the role",
 * written without checking whether anything already did: `ClinicalRail`
 * (`ward-management-navigation.tsx:214`) already renders `WardRoleSwitcher`, in the rail, and has
 * for a long time. That clause is superseded by the fact that it was already true — a second
 * switcher here would not be a design, it would be the same control rendered twice on one screen.
 */
export function WardShellHeader() {
  const pathname = usePathname();
  const { units } = useWardFlow();
  const place = wardPlaceFor(pathname, units);
  if (!place) return null;

  return (
    <div className={styles.header} data-testid="ward-shell-header">
      <span className={styles.place} data-testid="ward-shell-place">
        {place.name}
      </span>
    </div>
  );
}
