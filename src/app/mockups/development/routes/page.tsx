import type { Metadata } from "next";
import Link from "next/link";

import {
  CountTile,
  META_CLASS,
  MONO_CLASS,
  PanelSection,
  ROW_CLASS,
} from "@/components/developer-area/hub/panel-primitives";
import { PanelPageShell } from "@/components/developer-area/hub/panel-page-shell";
import { loadRepoAwarenessSnapshot, resolveRepoFreshness } from "@/lib/developer-area/repo-awareness-snapshot";

export const metadata: Metadata = {
  title: "Routes and modes · Developer · PsychSift",
  description: "Every page route, redirect, API route and app mode, read from the committed repository snapshot.",
};

const LINK_CLASS =
  "inline-flex min-h-12 items-center font-mono text-xs text-[color:var(--text-heading)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/**
 * A route containing a `[segment]` is a pattern, not an address. It is rendered
 * as text with the reason stated, rather than as a link that would always 404.
 *
 * This looks inconsistent with the "Design-scratch pages" section just below,
 * which links every one of its rows even though `src/proxy.ts` (`:225-231`)
 * blocks `/mockups/**` outside two allowed prefixes in production — every one
 * of those links also 404s there. The two cases still differ in the one way
 * that matters: a mockup link resolves wherever this hub is actually read —
 * in local development, before a change ever reaches production — so it is a
 * genuinely working link for its real audience, only unreachable in an
 * environment nobody is using it from. A `[segment]` link never resolves
 * anywhere, dev included, because no request ever supplies the missing
 * segment; there is no environment in which clicking it would do anything but
 * 404. Do not "fix" this by also refusing to link mockups — that would remove
 * the one working link class this page has.
 */
function RoutePath({ path }: { path: string }) {
  if (path.includes("[")) {
    return (
      <span data-testid={`developer-routes-page-${path}`} className={MONO_CLASS}>
        {path} <span className={META_CLASS}>· dynamic pattern, not a single address</span>
      </span>
    );
  }
  return (
    <Link data-testid={`developer-routes-page-${path}`} href={path} className={LINK_CLASS}>
      {path}
    </Link>
  );
}

export default function DeveloperRoutesPage() {
  const snapshot = loadRepoAwarenessSnapshot();
  const freshness = resolveRepoFreshness(snapshot, new Date());
  const { modes, pages, redirects, api, counts } = snapshot.routes;
  const productPages = pages.filter((page) => page.area === "product");
  const mockupPages = pages.filter((page) => page.area === "mockup");

  // `page.area` is typed `RouteArea` ("product" | "mockup") only because the
  // generator has never emitted a third value — `loadRepoAwarenessSnapshot`'s
  // runtime cast validates the snapshot's top-level `version`, never each
  // row's `area`, so a row with an unrecognised area is reachable, not
  // hypothetical. Dropping it silently would be the exact `#338` failure this
  // feature exists to prevent: a page that under-reports without a failing
  // test to catch it. The remainder is rendered under its own heading
  // instead, following `ledger/page.tsx`'s `unrecognised` precedent.
  //
  // Keyed on object identity, not on `path`: two route rows could share a
  // `path` (a redirect target and a page, for instance), and an identity-keyed
  // set is exact where a path-keyed one could swallow a second row.
  const recognisedPages = new Set<(typeof pages)[number]>([...productPages, ...mockupPages]);
  const otherPages = pages.filter((page) => !recognisedPages.has(page));

  return (
    <PanelPageShell
      testId="developer-routes"
      title="Routes and modes"
      freshness={freshness}
      freshnessLabel="Repository"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountTile testId="developer-routes-count-modes" value={counts.modes} label="app modes" />
        <CountTile testId="developer-routes-count-product" value={productPages.length} label="product pages" />
        <CountTile testId="developer-routes-count-mockup" value={mockupPages.length} label="design-scratch pages" />
        <CountTile testId="developer-routes-count-api" value={counts.api} label="API routes" />
      </div>

      <p className={META_CLASS}>
        Whether every page is reachable from real navigation is already guaranteed by a check that runs on every pull
        request, so it is not repeated here. This page answers what exists, not what is broken.
      </p>

      <PanelSection headingId="developer-routes-modes-heading" heading={`App modes · ${counts.modes}`}>
        <ul data-testid="developer-routes-modes" className="grid gap-2">
          {modes.map((mode) => (
            <li key={mode.id} className={ROW_CLASS}>
              <span className="text-sm font-bold text-[color:var(--text-heading)]">{mode.label}</span>
              <Link href={mode.home} className={LINK_CLASS}>
                {mode.home}
              </Link>
              {mode.dev_only ? <span className={META_CLASS}>· only visible in development</span> : null}
            </li>
          ))}
        </ul>
      </PanelSection>

      <PanelSection headingId="developer-routes-product-heading" heading={`Product pages · ${productPages.length}`}>
        <ul data-testid="developer-routes-pages-product" className="grid gap-2">
          {productPages.map((page) => (
            <li key={page.path} className={ROW_CLASS}>
              <RoutePath path={page.path} />
              <span className={META_CLASS}>{page.file}</span>
            </li>
          ))}
        </ul>
      </PanelSection>

      <PanelSection
        headingId="developer-routes-mockup-heading"
        heading={`Design-scratch pages · ${mockupPages.length}`}
      >
        <p className={META_CLASS}>
          These do not exist in production. They are exempt from the button-wiring and reachability checks, and from
          nothing else.
        </p>
        <ul data-testid="developer-routes-pages-mockup" className="grid gap-2">
          {mockupPages.map((page) => (
            <li key={page.path} className={ROW_CLASS}>
              <RoutePath path={page.path} />
              <span className={META_CLASS}>{page.file}</span>
            </li>
          ))}
        </ul>
      </PanelSection>

      {otherPages.length > 0 ? (
        <PanelSection headingId="developer-routes-other-heading" heading={`Other · ${otherPages.length}`}>
          <p className={META_CLASS}>
            These pages carry an area this page does not recognise. They are shown as they are rather than dropped, so
            together with the {productPages.length} product and {mockupPages.length} design-scratch pages counted above,
            nothing from this snapshot goes unlisted.
          </p>
          <ul data-testid="developer-routes-pages-other" className="grid gap-2">
            {otherPages.map((page) => (
              <li key={page.path} className={ROW_CLASS}>
                <RoutePath path={page.path} />
                <span className={META_CLASS}>{page.file}</span>
              </li>
            ))}
          </ul>
        </PanelSection>
      ) : null}

      <PanelSection headingId="developer-routes-redirects-heading" heading={`Redirects · ${counts.redirects}`}>
        {redirects.length > 0 ? (
          <ul data-testid="developer-routes-redirects" className="grid gap-2">
            {redirects.map((redirect) => (
              <li key={redirect.path} className={ROW_CLASS}>
                <span className={MONO_CLASS}>{redirect.path}</span>
                <span className={META_CLASS}>→</span>
                <span className={MONO_CLASS}>{redirect.target}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p data-testid="developer-routes-redirects" className={META_CLASS}>
            None. No route in the app redirects to another.
          </p>
        )}
      </PanelSection>

      <PanelSection headingId="developer-routes-api-heading" heading={`API routes · ${counts.api}`}>
        {api.length > 0 ? (
          <ul data-testid="developer-routes-api" className="grid gap-2">
            {api.map((route) => (
              <li key={route.path} className={ROW_CLASS}>
                {/* Not a link: an API route answers a fetch, not a visit. */}
                <span className={MONO_CLASS}>{route.path}</span>
                <span className={META_CLASS}>{route.file}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p data-testid="developer-routes-api" className={META_CLASS}>
            None. No route in the app serves as an API endpoint.
          </p>
        )}
      </PanelSection>
    </PanelPageShell>
  );
}
