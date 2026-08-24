import type { Metadata } from "next";
import Link from "next/link";

import { PanelPageShell } from "@/components/developer-area/hub/panel-page-shell";
import { loadRepoAwarenessSnapshot, resolveRepoFreshness } from "@/lib/developer-area/repo-awareness-snapshot";

export const metadata: Metadata = {
  title: "Routes and modes · Developer · Clinical KB",
  description: "Every page route, redirect, API route and app mode, read from the committed repository snapshot.",
};

const TILE_CLASS = "grid gap-1 rounded-xl border border-[color:var(--border)] p-4";
const TILE_NUMBER_CLASS = "text-2xl font-extrabold text-[color:var(--text-heading)]";
const TILE_LABEL_CLASS = "text-xs text-[color:var(--text-muted)]";
const SECTION_HEADING_CLASS = "text-lg font-extrabold text-[color:var(--text-heading)]";
const META_CLASS = "text-xs text-[color:var(--text-muted)]";
const MONO_CLASS = "font-mono text-xs text-[color:var(--text-heading)]";
const ROW_CLASS = "flex flex-wrap items-baseline gap-2 rounded-lg border border-[color:var(--border)] px-3 py-2";
const LINK_CLASS =
  "inline-flex min-h-12 items-center font-mono text-xs text-[color:var(--text-heading)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/** The number carries its own test id, so an assertion can read it apart from
 *  the label's prose — which contains digits of its own. */
function CountTile({ id, value, label }: { id: string; value: number; label: string }) {
  return (
    <div data-testid={`developer-routes-count-${id}`} className={TILE_CLASS}>
      <span data-testid={`developer-routes-count-${id}-value`} className={TILE_NUMBER_CLASS}>
        {value}
      </span>
      <span className={TILE_LABEL_CLASS}>{label}</span>
    </div>
  );
}

/**
 * A route containing a `[segment]` is a pattern, not an address. It is rendered
 * as text with the reason stated, rather than as a link that would always 404.
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

  return (
    <PanelPageShell
      testId="developer-routes"
      title="Routes and modes"
      freshness={freshness}
      freshnessLabel="Repository"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountTile id="modes" value={counts.modes} label="app modes" />
        <CountTile id="product" value={counts.product_pages} label="product pages" />
        <CountTile id="mockup" value={counts.mockup_pages} label="design-scratch pages" />
        <CountTile id="api" value={counts.api} label="API routes" />
      </div>

      <p className={META_CLASS}>
        Whether every page is reachable from real navigation is already guaranteed by a check that runs on every pull
        request, so it is not repeated here. This page answers what exists, not what is broken.
      </p>

      <section aria-labelledby="developer-routes-modes-heading" className="grid gap-3">
        <h2 id="developer-routes-modes-heading" className={SECTION_HEADING_CLASS}>
          App modes · {counts.modes}
        </h2>
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
      </section>

      <section aria-labelledby="developer-routes-product-heading" className="grid gap-3">
        <h2 id="developer-routes-product-heading" className={SECTION_HEADING_CLASS}>
          Product pages · {counts.product_pages}
        </h2>
        <ul data-testid="developer-routes-pages-product" className="grid gap-2">
          {productPages.map((page) => (
            <li key={page.path} className={ROW_CLASS}>
              <RoutePath path={page.path} />
              <span className={META_CLASS}>{page.file}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="developer-routes-mockup-heading" className="grid gap-3">
        <h2 id="developer-routes-mockup-heading" className={SECTION_HEADING_CLASS}>
          Design-scratch pages · {counts.mockup_pages}
        </h2>
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
      </section>

      <section aria-labelledby="developer-routes-redirects-heading" className="grid gap-3">
        <h2 id="developer-routes-redirects-heading" className={SECTION_HEADING_CLASS}>
          Redirects · {counts.redirects}
        </h2>
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
      </section>

      <section aria-labelledby="developer-routes-api-heading" className="grid gap-3">
        <h2 id="developer-routes-api-heading" className={SECTION_HEADING_CLASS}>
          API routes · {counts.api}
        </h2>
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
            None.
          </p>
        )}
      </section>
    </PanelPageShell>
  );
}
