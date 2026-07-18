import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TcProvider, useTcBindings } from "@/components/therapy-compass/bindings";

// Capture router pushes and drive pathname/search so we can assert where the
// artifact-navigation helpers route.
const nav = vi.hoisted(() => ({ pathname: "/therapy-compass", search: "", pushes: [] as string[] }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({
    push: (href: string) => nav.pushes.push(href),
    replace: () => {},
    prefetch: () => {},
  }),
}));

// One record ships both artifacts, one ships neither (like the real `emdr` stub).
vi.mock("@/components/therapy-compass/data/use-therapy-data", () => ({
  useTherapyData: () => ({
    data: {
      therapies: [
        {
          slug: "with-both",
          name: "With Both",
          category: "X",
          modality: null,
          tags: [],
          aliases: [],
          warnings: [],
          sources: [],
          patientSheetTemplates: [],
          clinicianScripts: [],
          reviewChecklist: null,
          reviewStatus: "reviewed",
          briefInterventionAvailable: true,
          patientSheetAvailable: true,
        },
        {
          slug: "no-artifacts",
          name: "No Artifacts",
          category: "X",
          modality: null,
          tags: [],
          aliases: [],
          warnings: [],
          sources: [],
          patientSheetTemplates: [],
          clinicianScripts: [],
          reviewChecklist: null,
          reviewStatus: "needs_review",
          briefInterventionAvailable: false,
          patientSheetAvailable: false,
        },
      ],
      pathways: [],
      reference: { categories: [], tags: [], measures: [] },
    },
    loading: false,
    error: null,
    retry: () => {},
  }),
}));

afterEach(() => {
  nav.pushes.length = 0;
});

function Probe() {
  const b = useTcBindings();
  return (
    <div>
      <button data-testid="select-both" onClick={() => b.select("with-both")} />
      <button data-testid="open-sheet-both" onClick={() => b.openSheet("with-both")} />
      <button data-testid="open-sheet-none" onClick={() => b.openSheet("no-artifacts")} />
      <button data-testid="open-brief-none" onClick={() => b.openBrief("no-artifacts")} />
    </div>
  );
}

describe("Therapy Compass artifact-route navigation", () => {
  it("routes a picker selection on a /sheet subroute to the chosen therapy's sheet (not left pinned to the URL)", () => {
    nav.pathname = "/therapy-compass/no-artifacts/sheet";
    nav.search = "";
    const { getByTestId } = render(
      <TcProvider>
        <Probe />
      </TcProvider>,
    );
    fireEvent.click(getByTestId("select-both"));
    expect(nav.pushes).toContain("/therapy-compass/with-both/sheet");
  });

  it("falls back to the detail page instead of routing to an unavailable brief/sheet subroute (no 404)", () => {
    nav.pathname = "/therapy-compass/with-both";
    nav.search = "";
    const { getByTestId } = render(
      <TcProvider>
        <Probe />
      </TcProvider>,
    );
    fireEvent.click(getByTestId("open-sheet-none"));
    fireEvent.click(getByTestId("open-brief-none"));
    expect(nav.pushes).toContain("/therapy-compass/no-artifacts");
    expect(nav.pushes).not.toContain("/therapy-compass/no-artifacts/sheet");
    expect(nav.pushes).not.toContain("/therapy-compass/no-artifacts/brief");
  });

  it("routes to the artifact subroute when the record ships it", () => {
    nav.pathname = "/therapy-compass/with-both";
    nav.search = "";
    const { getByTestId } = render(
      <TcProvider>
        <Probe />
      </TcProvider>,
    );
    fireEvent.click(getByTestId("open-sheet-both"));
    expect(nav.pushes).toContain("/therapy-compass/with-both/sheet");
  });
});
