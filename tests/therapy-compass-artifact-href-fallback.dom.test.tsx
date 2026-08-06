import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TcProvider, useTcBindings } from "@/components/therapy-compass/bindings";
import { THERAPY_CATALOGUE_SUMMARY } from "@/components/therapy-compass/data/generated-assets";

/**
 * The empty-catalogue case, which the sibling artifact-navigation suite cannot
 * cover because its data mock is module-level.
 *
 * `ModeNav` renders its destinations as `<Link>`s, so Brief Intervention and
 * Patient Sheets need a real URL before any catalogue has loaded — on the
 * server pass, on the mode home (where `TcProvider` deliberately fetches
 * nothing), and through every render while the fetch is in flight. An href of
 * `/therapy-compass/undefined/brief` would prefetch a 404 and break
 * middle-click; that is what the unconditional generated-asset fallback exists
 * to prevent, and why it is not gated on the home route the way the old
 * imperative handler's was.
 */

const nav = vi.hoisted(() => ({ pathname: "/therapy-compass", search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
}));

vi.mock("@/components/therapy-compass/data/use-therapy-data", () => ({
  useTherapyData: () => ({ data: null, loading: true, error: null, retry: () => {} }),
}));

function Probe() {
  const b = useTcBindings();
  return (
    <div>
      <a data-testid="brief-href" href={b.briefHref} />
      <a data-testid="sheet-href" href={b.sheetHref} />
    </div>
  );
}

describe("Therapy Compass artifact hrefs with no catalogue", () => {
  for (const pathname of ["/therapy-compass", "/therapy-compass/search", "/therapy-compass/pathways"]) {
    it(`resolves to the generated default slug on ${pathname}`, () => {
      nav.pathname = pathname;
      const { getByTestId } = render(
        <TcProvider>
          <Probe />
        </TcProvider>,
      );

      const brief = getByTestId("brief-href").getAttribute("href");
      const sheet = getByTestId("sheet-href").getAttribute("href");

      expect(brief).toBe(`/therapy-compass/${THERAPY_CATALOGUE_SUMMARY.defaultBriefSlug}/brief`);
      expect(sheet).toBe(`/therapy-compass/${THERAPY_CATALOGUE_SUMMARY.defaultSheetSlug}/sheet`);
      for (const href of [brief, sheet]) {
        expect(href).not.toContain("undefined");
        expect(href).not.toContain("//");
      }
    });
  }
});
