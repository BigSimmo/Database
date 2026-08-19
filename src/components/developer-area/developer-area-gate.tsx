import { headers } from "next/headers";
import type { ReactNode } from "react";

import { mockupsEnabled } from "@/lib/env";
import { DEVELOPER_AREA_PATH_HEADER } from "@/lib/developer-area/headers";
import { resolveDeveloperAccessState } from "@/lib/developer-area/access";

import { DeveloperGateScreen } from "./developer-gate-screen";

/**
 * Wraps `/mockups/development` and `/mockups/caring-contacts/**` (the two
 * subtrees `src/proxy.ts` carves out of the blanket `/mockups` production
 * gate). Outside production — or with the explicit opt-in flag — this is a
 * no-op, matching every other /mockups/* route. In production it requires a
 * signed-in administrator (see `resolveDeveloperAccessState`), showing a
 * sign-in screen or an access-denied screen instead of the real content.
 */
export async function DeveloperAreaGate({ children }: { children: ReactNode }) {
  if (mockupsEnabled()) {
    return <>{children}</>;
  }

  const { state, email } = await resolveDeveloperAccessState();
  if (state === "authorized") {
    return <>{children}</>;
  }

  const next = (await headers()).get(DEVELOPER_AREA_PATH_HEADER) || "/mockups/development";
  return <DeveloperGateScreen state={state} next={next} email={email} />;
}
