import { headers } from "next/headers";
import type { ReactNode } from "react";

import { DEVELOPER_AREA_PATH_HEADER } from "@/lib/developer-area/headers";
import {
  developerGateBypassAllowed,
  developerLinkAccessGranted,
  resolveDeveloperAccessState,
} from "@/lib/developer-area/access";

import { DeveloperAreaRouteGuard } from "./developer-area-route-guard";
import { DeveloperGateScreen } from "./developer-gate-screen";

/**
 * Wraps every prefix in `DEVELOPER_GATED_PATH_PREFIXES`
 * (`src/lib/developer-area/headers.ts`) and its subtree — the exact list
 * `src/proxy.ts` carves out of the blanket `/mockups` production gate. That
 * constant is the single place those paths are written down; re-listing them
 * here would be a second copy to keep in step, and one of them is Ward Flow's,
 * whose seam guard (`tests/ward-flow-seam.test.ts`) counts every file outside
 * Ward Flow that spells its route out. Outside production this gate is a no-op,
 * matching every other /mockups/* route. In production it requires a signed-in administrator
 * (see `resolveDeveloperAccessState`), showing a sign-in screen or an
 * access-denied screen instead of the real content — UNLESS
 * `developerGateBypassAllowed()` reports the exact double-flag exception the
 * isolated Playwright production build uses (`PLAYWRIGHT_OFFLINE_MODE=true`
 * together with `NEXT_PUBLIC_MOCKUPS_ENABLED=true`). The mockups flag alone
 * must never disable this gate on a real deployment (#L30).
 *
 * A signed-in administrator is not the only way through. A visitor holding the
 * passwordless access cookie — issued by `src/proxy.ts` in exchange for the
 * `?devkey=…` secret, see `src/lib/developer-area/link-access.ts` — is admitted
 * too, so the owner's bookmarked link opens this subtree with no sign-in at all.
 * That credential is additive: it admits nobody the administrator claim would
 * have admitted less of, and it is off entirely unless `DEVELOPER_AREA_ACCESS_KEY`
 * is configured at sufficient strength.
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

  // The passwordless route. Checked before the Supabase call because it is the
  // expected path on the owner's own devices, and because it needs no provider
  // round trip to answer. Wrapped in the same route guard as the administrator
  // branch so a revoked cookie (the key rotated in Railway) stops working on the
  // next client-side navigation rather than at the next hard reload (#L31).
  if (await developerLinkAccessGranted()) {
    return <DeveloperAreaRouteGuard>{children}</DeveloperAreaRouteGuard>;
  }

  const { state, email } = await resolveDeveloperAccessState();
  if (state === "authorized") {
    return <DeveloperAreaRouteGuard>{children}</DeveloperAreaRouteGuard>;
  }

  const next = (await headers()).get(DEVELOPER_AREA_PATH_HEADER) || "/mockups/development";
  return <DeveloperGateScreen state={state} next={next} email={email} />;
}
