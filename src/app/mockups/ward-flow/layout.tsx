import type { ReactNode } from "react";

import { DeveloperAreaGate } from "@/components/developer-area/developer-area-gate";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

/**
 * Holds the shared reducer state and clock above every ward route, same as the
 * pre-move layout. The order matters, matching
 * `src/app/mockups/care-plan/layout.tsx` and `src/app/mockups/caring-contacts/layout.tsx`:
 * `DeveloperAreaGate` is outermost, so an unauthorised visitor meets the sign-in
 * screen and never reaches `WardFlowProvider` or any prototype content. No
 * screen wires the provider itself: a route rendered without this layout in its
 * path must throw via `useWardFlow` rather than render a substituted empty world.
 */
export default function WardFlowMockupLayout({ children }: { children: ReactNode }) {
  return (
    <DeveloperAreaGate>
      <WardFlowProvider>{children}</WardFlowProvider>
    </DeveloperAreaGate>
  );
}
