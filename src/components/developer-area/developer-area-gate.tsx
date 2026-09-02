import { headers } from "next/headers";
import type { ReactNode } from "react";

import { DEVELOPER_AREA_PATH_HEADER } from "@/lib/developer-area/headers";
import { developerGateBypassAllowed, resolveDeveloperAccessState } from "@/lib/developer-area/access";

import { DeveloperAreaRouteGuard } from "./developer-area-route-guard";
import { DeveloperGateScreen } from "./developer-gate-screen";

/**
 * Wraps every prefix in `DEVELOPER_GATED_PATH_PREFIXES`
 * (`src/lib/developer-area/headers.ts`) — the subtrees `src/proxy.ts` carves
 * out of the blanket `/mockups` production gate: `/mockups/development`,
 * `/mockups/caring-contacts/**`, `/mockups/care-plan/**` and
 * `/mockups/ward-flow/**`. Outside production this is a no-op, matching every
 * other /mockups/* route. In production it requires a signed-in administrator
 * (see `resolveDeveloperAccessState`), showing a sign-in screen or an
 * access-denied screen instead of the real content — UNLESS
 * `developerGateBypassAllowed()` reports the exact double-flag exception the
 * isolated Playwright production build uses (`PLAYWRIGHT_OFFLINE_MODE=true`
 * together with `NEXT_PUBLIC_MOCKUPS_ENABLED=true`). The mockups flag alone
 * must never disable this gate on a real deployment (#L30).
 *
 * The authorized branch wraps `children` in `DeveloperAreaRouteGuard`, which
 * re-runs this check on every client-side navigation between the subtree's
 * own sibling pages, because the App Router does not re-render this shared
 * layout for those navigations on its own (#L31).
 */
export async function DeveloperAreaGate({ children }: { children: ReactNode }) {
  if (developerGateBypassAllowed()) {
    return <>{children}</>;
  }

  const { state, email } = await resolveDeveloperAccessState();
  if (state === "authorized") {
    return <DeveloperAreaRouteGuard>{children}</DeveloperAreaRouteGuard>;
  }

  const next = (await headers()).get(DEVELOPER_AREA_PATH_HEADER) || "/mockups/development";
  return <DeveloperGateScreen state={state} next={next} email={email} />;
}
