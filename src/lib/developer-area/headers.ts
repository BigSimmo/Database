// Shared between `src/proxy.ts` and the Server Components it signals to
// (`src/app/mockups/layout.tsx`, `DeveloperAreaGate`). Pure string constants only
// — no side effects, no stateful singletons — so this is safe to import from a
// Proxy file per its "no shared modules/globals" guidance.
//
// Deliberately not under `src/lib/mockups/**` or anything matching `*mockup*`:
// this is real production authorization code (it runs in `src/proxy.ts` on
// every request), and `no-restricted-imports` forbids production code from
// depending on anything path-matched as mockup/design-scratch.

/** Set to "1" by proxy.ts only for the gated prefixes below; stripped from every
 *  other /mockups/** request so a client cannot spoof it and read a hidden
 *  design-scratch mockup by sending the header itself. */
export const DEVELOPER_AREA_HEADER = "x-developer-area";

/** The exact requested path+query, so a sign-in redirect can return the visitor
 *  to the specific page they asked for (e.g. a deep Caring Contact route), not
 *  just the area root. */
export const DEVELOPER_AREA_PATH_HEADER = "x-developer-area-path";

/** Exact prefixes only. A path that merely begins with the same characters —
 *  `/mockups/care-plan-archive`, say — is not a match and stays behind the
 *  blanket production block, because `isDeveloperGatedPath` requires either an
 *  exact hit or a following `/`. Add a prefix here one subtree at a time; never
 *  widen this to `/mockups`. */
export const DEVELOPER_GATED_PATH_PREFIXES = [
  "/mockups/development",
  "/mockups/caring-contacts",
  "/mockups/care-plan",
  "/mockups/ward-flow",
] as const;
