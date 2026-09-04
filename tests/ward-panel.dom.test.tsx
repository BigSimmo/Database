// tests/ward-panel.dom.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardPanel } from "@/components/ward-management/ward-panel";

describe("WardPanel", () => {
  it("renders its title as a heading and its count beside it", () => {
    render(
      <WardPanel title="Coming in" count="6 waiting">
        <p>rows</p>
      </WardPanel>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Coming in" })).toBeInTheDocument();
    expect(screen.getByText("6 waiting")).toBeInTheDocument();
  });

  it("labels the section by its own heading, so a screen reader can list the panels", () => {
    render(<WardPanel title="Needs a decision">x</WardPanel>);
    expect(screen.getByRole("region", { name: "Needs a decision" })).toBeInTheDocument();
  });

  it("takes a heading level, because a panel nested in a section must not skip a level", () => {
    render(
      <WardPanel title="In hospital now" headingLevel={3}>
        x
      </WardPanel>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "In hospital now" })).toBeInTheDocument();
  });

  it("omits the count element entirely when there is no count, rather than rendering an empty span", () => {
    const { container } = render(<WardPanel title="Go to">x</WardPanel>);
    expect(container.querySelector("[data-ward-panel-count]")).toBeNull();
  });
});
