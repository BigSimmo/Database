/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WhereIsHomePanel } from "@/components/first-nations/where-is-home";
import type { WaMap } from "@/lib/first-nations/content-schema";
import type { ContactView, RegionView, SourceView } from "@/lib/first-nations/view-model";

const source: SourceView = {
  title: "WA Country Health Service Guide",
  url: "https://example.org/wachs",
};

const interpreterContact: ContactView = {
  id: "aiwa",
  name: "Aboriginal Interpreting WA (AIWA)",
  detail: "Book 24 h ahead",
  number: "1800 330 331",
  hours: null,
  reportHref: null,
  source,
  checkedAt: "2026-09-26",
};

const testRegions: RegionView[] = [
  {
    id: "kimberley",
    label: "Kimberley",
    source,
    checkedAt: "2026-09-26",
    languages: ["Kriol", "Walmajarri", "Yawuru"],
    services: [
      {
        id: "kamsc",
        name: "Kimberley Aboriginal Medical Services",
        detail: "Broome hub",
        number: "(08) 9194 3200",
        hours: null,
        reportHref: null,
        source,
        checkedAt: "2026-09-26",
      },
    ],
  },
  {
    id: "goldfields",
    label: "Goldfields",
    source,
    checkedAt: "2026-09-26",
    languages: ["Wangkatha", "Pitjantjatjara"],
    services: [
      {
        id: "bega",
        name: "Bega Garnbirringu Health Service",
        detail: "Kalgoorlie",
        number: "(08) 9022 5500",
        hours: null,
        reportHref: null,
        source,
        checkedAt: "2026-09-26",
      },
    ],
  },
];

const testMap: WaMap = {
  version: 1,
  sourceId: "src-wa-health",
  checkedAt: "2026-09-26",
  viewBox: "0 0 100 100",
  regions: [
    { id: "kimberley", path: "M10 10 H40 V40 H10 Z" },
    { id: "goldfields", path: "M50 50 H90 V90 H50 Z" },
  ],
};

describe("Feature 6: First Nations Interactive Bedside Map & Cultural Briefing", () => {
  it("renders WA map paths with accessible buttons and selects region on click", () => {
    render(
      <WhereIsHomePanel regions={testRegions} map={testMap} interpreter={interpreterContact} mapSource={source} />,
    );

    // Initial state: no briefing card displayed
    expect(screen.queryByTestId("fn-cultural-briefing-kimberley")).toBeNull();

    // Click on Kimberley region path on the SVG map
    const kimberleyPath = screen.getByTestId("fn-map-region-kimberley");
    expect(kimberleyPath).toBeInTheDocument();
    expect(kimberleyPath).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(kimberleyPath);

    // Kimberley should now be pressed
    expect(kimberleyPath).toHaveAttribute("aria-pressed", "true");

    // No unsourced cultural guidance is rendered: patient-care advice must come from the governed content model.
    expect(screen.queryByTestId("fn-cultural-briefing-kimberley")).toBeNull();

    // Services and languages are displayed
    expect(screen.getByText("Kimberley Aboriginal Medical Services")).toBeInTheDocument();
    expect(screen.getByText("Kriol")).toBeInTheDocument();
  });

  it("supports keyboard navigation on map paths (Enter/Space selection)", () => {
    render(
      <WhereIsHomePanel regions={testRegions} map={testMap} interpreter={interpreterContact} mapSource={source} />,
    );

    const goldfieldsPath = screen.getByTestId("fn-map-region-goldfields");
    expect(goldfieldsPath).toHaveAttribute("tabindex", "0");

    // Press Enter to select
    fireEvent.keyDown(goldfieldsPath, { key: "Enter" });

    expect(goldfieldsPath).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("fn-cultural-briefing-goldfields")).toBeNull();
  });

  it("strictly preserves bedside privacy: never saves home region to storage", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(
      <WhereIsHomePanel regions={testRegions} map={testMap} interpreter={interpreterContact} mapSource={source} />,
    );

    const kimberleyPath = screen.getByTestId("fn-map-region-kimberley");
    fireEvent.click(kimberleyPath);

    // Verify localStorage/sessionStorage are untouched
    expect(setItemSpy).not.toHaveBeenCalled();
    expect(screen.getByText("Never saved or sent")).toBeInTheDocument();
  });
});
