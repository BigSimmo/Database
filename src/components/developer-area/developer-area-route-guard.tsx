"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * `DeveloperAreaGate`'s administrator check is a Server Component that runs
 * once, at the first render of the shared layout it sits in — the layout
 * covering every prefix in `DEVELOPER_GATED_PATH_PREFIXES`
 * (`src/lib/developer-area/headers.ts`), which is where those paths are
 * written down rather than repeated here. The App Router preserves that
 * layout instance across
 * a soft client-side navigation between its own sibling pages — the hub to
 * `/ledger`, `/routes`, `/review-state`, ... — so the check is NOT re-run for
 * those navigations, only for a hard reload or a fresh top-level visit
 * (`docs/agents` verified against `node_modules/next/dist/docs`: "[navigation]
 * keeps any shared layouts and UI"). A session that signs out elsewhere or
 * expires mid-visit therefore keeps returning already-authorized sibling
 * page payloads until a hard reload (#L31).
 *
 * This client-only guard sits just inside the gate, wrapping its authorized
 * children. On every pathname change within the gated subtree it calls
 * `router.refresh()`, which re-fetches the whole Server Component tree for
 * the new URL from the server's current cookies — including `DeveloperAreaGate`
 * itself — instead of reusing the client Router Cache's already-authorized
 * payload (the same re-validation technique already used for data staleness
 * in `contact-time-adjustment.tsx` and `plan-actions.tsx`). The very first
 * render is skipped: the gate already ran the check server-side for that
 * exact URL before this component ever mounted, so refreshing immediately
 * would only repeat a fetch that just happened.
 */
export function DeveloperAreaRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mountedPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname === mountedPathRef.current) return;
    mountedPathRef.current = pathname;
    router.refresh();
  }, [pathname, router]);

  return <>{children}</>;
}
