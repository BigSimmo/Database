import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InformationPageBreadcrumbs, InformationPageShell } from "@/components/information-page-shell";
import { isInformationPage } from "@/lib/information-pages";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));

describe("isInformationPage", () => {
  it("recognises catalogue detail routes per mode", () => {
    expect(isInformationPage("/services/acuity")).toBe(true);
    expect(isInformationPage("/forms/transport-crisis-form")).toBe(true);
    expect(isInformationPage("/medications/lithium")).toBe(true);
    expect(isInformationPage("/specifiers/with-anxious-distress")).toBe(true);
    expect(isInformationPage("/formulation/avoidance")).toBe(true);
    expect(isInformationPage("/factsheets/ssri-start")).toBe(true);
    expect(isInformationPage("/dictionary/auditory-hallucination")).toBe(true);
    expect(isInformationPage("/dictionary/topics/psychosis-and-perception")).toBe(true);
    expect(isInformationPage("/dsm/diagnoses/mdd")).toBe(true);
    expect(isInformationPage("/differentials/diagnoses/delirium")).toBe(true);
    expect(isInformationPage("/documents/abc")).toBe(true);
  });

  it("excludes mode homes, builders, and search surfaces", () => {
    expect(isInformationPage("/services")).toBe(false);
    expect(isInformationPage("/forms")).toBe(false);
    expect(isInformationPage("/specifiers/builder")).toBe(false);
    expect(isInformationPage("/formulation/compare")).toBe(false);
    expect(isInformationPage("/factsheets/search")).toBe(false);
    expect(isInformationPage("/factsheets/topics")).toBe(false);
    expect(isInformationPage("/dictionary/search")).toBe(false);
    expect(isInformationPage("/dictionary/topics")).toBe(false);
    expect(isInformationPage("/documents/search")).toBe(false);
    expect(isInformationPage("/therapy-compass/search")).toBe(false);
    expect(isInformationPage("/therapy-compass/recommend")).toBe(false);
    expect(isInformationPage("/services/search")).toBe(false);
    expect(isInformationPage("/forms/search")).toBe(false);
  });
});

describe("InformationPageShell", () => {
  it("renders a main landmark with the default container", () => {
    render(
      <InformationPageShell testId="info-shell">
        <p>Body</p>
      </InformationPageShell>,
    );
    const main = screen.getByTestId("info-shell");
    expect(main.tagName).toBe("MAIN");
    expect(main.querySelector(".max-w-7xl")).not.toBeNull();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("uses the shared reading-width container for narrow information pages", () => {
    render(
      <InformationPageShell testId="narrow-info-shell" width="narrow">
        <p>Reading body</p>
      </InformationPageShell>,
    );

    expect(screen.getByTestId("narrow-info-shell").querySelector(".max-w-reading")).not.toBeNull();
  });

  it("exposes shared breadcrumbs as a link back to the mode home", () => {
    render(
      <InformationPageBreadcrumbs
        home={{ label: "Forms", href: "/forms?focus=1" }}
        crumbs={[{ label: "Catalogue" }]}
        current="Transport"
      />,
    );
    const home = screen.getByRole("link", { name: /Forms/i });
    expect(home).toHaveAttribute("href", "/forms?focus=1");
    expect(screen.getByText("Transport")).toHaveAttribute("aria-current", "page");
  });

  it("renders a text-only home crumb when homeIcon is false", () => {
    render(
      <InformationPageBreadcrumbs
        home={{ label: "DSM-5 Diagnosis home", href: "/dsm" }}
        homeIcon={false}
        current="Compare"
      />,
    );

    const home = screen.getByRole("link", { name: "DSM-5 Diagnosis home" });
    expect(home).toHaveAttribute("href", "/dsm");
    expect(home.querySelector("svg")).toBeNull();
  });

  it("keeps a linked intermediate crumb a link after the fold onto Breadcrumb", () => {
    // The DS `Breadcrumb` decides link-vs-text from `href`, not from position.
    // Deciding on position would turn this middle crumb into dead text the
    // moment a page put the current record's parent in the trail.
    render(
      <InformationPageBreadcrumbs
        home={{ label: "Forms", href: "/forms" }}
        crumbs={[{ label: "Catalogue", href: "/forms?tab=catalogue" }]}
        current="Transport"
      />,
    );

    expect(screen.getByRole("link", { name: "Catalogue" })).toHaveAttribute("href", "/forms?tab=catalogue");
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByText("Transport")).toHaveAttribute("aria-current", "page");
  });
});
