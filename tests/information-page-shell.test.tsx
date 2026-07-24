import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InformationPageBreadcrumbs, InformationPageShell } from "@/components/information-page-shell";
import { isInformationPage } from "@/lib/information-pages";

describe("isInformationPage", () => {
  it("recognises catalogue detail routes per mode", () => {
    expect(isInformationPage("/services/acuity")).toBe(true);
    expect(isInformationPage("/forms/transport-crisis-form")).toBe(true);
    expect(isInformationPage("/medications/lithium")).toBe(true);
    expect(isInformationPage("/specifiers/with-anxious-distress")).toBe(true);
    expect(isInformationPage("/formulation/avoidance")).toBe(true);
    expect(isInformationPage("/factsheets/ssri-start")).toBe(true);
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
    expect(isInformationPage("/documents/search")).toBe(false);
    expect(isInformationPage("/therapy-compass/search")).toBe(false);
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
});
