import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";

import { DeveloperAreaRouteGuard } from "@/components/developer-area/developer-area-route-guard";
import { WardFlowKeyGateScreen } from "@/components/developer-area/ward-flow-key-gate-screen";
import { DEVELOPER_AREA_PATH_HEADER } from "@/lib/developer-area/headers";
import {
  DEVELOPER_ACCESS_COOKIE,
  developerAccessTokenValid,
  parseDeveloperGateTarget,
  resolveDeveloperAccessKey,
} from "@/lib/developer-area/link-access";

function offlinePrototypeBypassAllowed(environment: Record<string, string | undefined> = process.env): boolean {
  if (environment.NODE_ENV !== "production") return true;
  return environment.PLAYWRIGHT_OFFLINE_MODE === "true" && environment.NEXT_PUBLIC_MOCKUPS_ENABLED === "true";
}

/**
 * Ward Flow's production access boundary.
 *
 * The other developer areas may fall back to a Clinical KB administrator
 * account. Ward Flow must not: it is a standalone, synthetic prototype with no
 * database relationship. Production access is therefore the signed developer
 * cookie only; local development and the isolated offline Playwright profile
 * keep their existing bypass.
 */
export async function WardFlowAccessGate({ children }: { children: ReactNode }) {
  if (offlinePrototypeBypassAllowed()) return <>{children}</>;

  const cookieStore = await cookies();
  const hasAccess = developerAccessTokenValid(cookieStore.get(DEVELOPER_ACCESS_COOKIE)?.value);
  if (hasAccess) return <DeveloperAreaRouteGuard>{children}</DeveloperAreaRouteGuard>;

  const { target, keyRejected } = parseDeveloperGateTarget((await headers()).get(DEVELOPER_AREA_PATH_HEADER));
  return (
    <WardFlowKeyGateScreen
      next={target}
      keyEntryEnabled={resolveDeveloperAccessKey() !== null}
      keyRejected={keyRejected}
    />
  );
}
