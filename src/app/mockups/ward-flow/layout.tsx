import type { ReactNode } from "react";

import { DeveloperAreaGate } from "@/components/developer-area/developer-area-gate";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardGround, WardShellHeader } from "@/components/ward-management/ward-shell";

/**
 * Holds the shared reducer state and clock above every ward route, same as the
 * pre-move layout. The order matters, matching
 * `src/app/mockups/care-plan/layout.tsx` and `src/app/mockups/caring-contacts/layout.tsx`:
 * `DeveloperAreaGate` is outermost, so an unauthorised visitor meets the sign-in
 * screen and never reaches `WardFlowProvider` or any prototype content. No
 * screen wires the provider itself: a route rendered without this layout in its
 * path must throw via `useWardFlow` rather than render a substituted empty world.
 *
 * `WardGround` wraps `children` here — the whole of every route's own output, `<main>` included
 * — because this is the only place in the tree that is an ancestor of every route's content
 * (docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md, Task 6, ruling
 * 2026-09-04: the ground was originally meant to mount inside `ClinicalRail`, which is a SIBLING
 * of `<main>` at every one of its ~26 call sites and could never reach it). `WardShellHeader`
 * mounts alongside it, inside the ground, rather than inside `ClinicalRail`: it derives the
 * route's place itself from `usePathname`, needs no ward-flow state, and rendering it here keeps
 * it an ordinary in-flow element rather than nested inside the rail's own fixed phone bar
 * (Decision 3, amended 2026-09-04 — see `ward-shell.tsx`'s doc comments on both components).
 */
export default function WardFlowMockupLayout({ children }: { children: ReactNode }) {
  return (
    <DeveloperAreaGate>
      <WardFlowProvider>
        <WardGround>
          <WardShellHeader />
          {children}
        </WardGround>
      </WardFlowProvider>
    </DeveloperAreaGate>
  );
}
