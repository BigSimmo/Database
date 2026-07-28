import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SecondaryNavigation,
  SecondaryNavigationShellHostProvider,
  type SecondaryNavigationItem,
} from "@/components/secondary-navigation";

afterEach(() => {
  window.history.replaceState(null, "", "/");
  document.documentElement.removeAttribute("data-motion");
});

function ControlledTabs() {
  const [active, setActive] = useState("summary");
  const items: SecondaryNavigationItem[] = ["summary", "dosing", "safety", "more"].map((id) => ({
    kind: "action",
    id,
    label: id[0].toUpperCase() + id.slice(1),
    controlsId: `panel-${id}`,
    onSelect: () => setActive(id),
  }));
  return <SecondaryNavigation ariaLabel="Medication sections" items={items} activeId={active} tablist />;
}

function ShellPlacedNavigation() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <SecondaryNavigationShellHostProvider host={host}>
      <div data-testid="shell-navigation-host" ref={setHost} />
      <div data-testid="page-content">
        <SecondaryNavigation
          ariaLabel="Page sections"
          placeInShell
          items={[{ kind: "section", id: "overview", label: "Overview", targetId: "overview" }]}
        />
        <section id="overview" />
      </div>
    </SecondaryNavigationShellHostProvider>
  );
}

describe("SecondaryNavigation", () => {
  it("exposes route and action current-page semantics without a Home item", () => {
    render(
      <SecondaryNavigation
        ariaLabel="Differentials mode"
        activeId="diagnoses"
        items={[
          { kind: "route", id: "search", label: "Search", href: "/differentials" },
          { kind: "route", id: "diagnoses", label: "Diagnoses", href: "/differentials/diagnoses" },
          { kind: "action", id: "compare", label: "Compare", onSelect: vi.fn() },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Diagnoses" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Search" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByText("Home")).toBeNull();
  });

  it("places page-owned navigation in the shell host without a second sticky layer", async () => {
    render(<ShellPlacedNavigation />);

    const navigation = screen.getByRole("navigation", { name: "Page sections" });
    const host = screen.getByTestId("shell-navigation-host");
    await waitFor(() => expect(host).toContainElement(navigation));
    expect(screen.getByTestId("page-content")).not.toContainElement(navigation);
    expect(navigation).not.toHaveClass("sticky");
  });

  it("uses fragment links, location semantics, history, and reduced-motion-aware scrolling", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
      const top = this.id === "section-two" ? 500 : 0;
      return { x: 0, y: top, top, left: 0, right: 100, bottom: top + 40, width: 100, height: 40, toJSON() {} };
    });
    document.documentElement.setAttribute("data-motion", "reduced");
    window.history.replaceState({ nextRouteTree: "preserved" }, "", "/");

    render(
      <div>
        <SecondaryNavigation
          ariaLabel="On this page"
          items={[
            { kind: "section", id: "one", label: "Overview", targetId: "section-one" },
            {
              kind: "section",
              id: "two",
              label: "Safety",
              targetId: "section-two",
              fragmentId: "safety",
            },
          ]}
        />
        <section id="section-one" />
        <section id="section-two" />
      </div>,
    );

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "location"),
    );
    const safety = screen.getByRole("link", { name: "Safety" });
    expect(safety).toHaveAttribute("href", "#safety");
    fireEvent.click(safety);
    expect(window.location.hash).toBe("#safety");
    expect(window.history.state).toEqual({ nextRouteTree: "preserved" });
    expect(safety).toHaveAttribute("aria-current", "location");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("implements roving tab focus with Arrow, Home, and End keys", async () => {
    const user = userEvent.setup();
    render(<ControlledTabs />);

    const summary = screen.getByRole("tab", { name: "Summary" });
    const dosing = screen.getByRole("tab", { name: "Dosing" });
    const more = screen.getByRole("tab", { name: "More" });
    expect(summary).toHaveAttribute("aria-selected", "true");
    expect(summary).toHaveAttribute("aria-controls", "panel-summary");

    summary.focus();
    await user.keyboard("{ArrowRight}");
    expect(dosing).toHaveFocus();
    expect(dosing).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{End}");
    expect(more).toHaveFocus();
    expect(more).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(summary).toHaveFocus();
    expect(summary).toHaveAttribute("aria-selected", "true");
  });

  it("aligns an initial deep-linked fragment below the pinned bar", async () => {
    window.history.replaceState(null, "", "/#section-two");
    render(
      <div>
        <SecondaryNavigation
          ariaLabel="On this page"
          items={[
            { kind: "section", id: "one", label: "Overview", targetId: "section-one" },
            { kind: "section", id: "two", label: "Safety", targetId: "section-two" },
          ]}
        />
        <section id="section-one" />
        <section id="section-two" />
      </div>,
    );

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Safety" })).toHaveAttribute("aria-current", "location"),
    );
    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" }),
    );
  });

  it("keeps a fragment-selected section current at the shared scroll-margin offset", async () => {
    let safetyTop = 500;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
      const top = this.id === "section-two" ? safetyTop : this.tagName === "NAV" ? 0 : -200;
      const height = this.tagName === "NAV" ? 56 : 40;
      return { x: 0, y: top, top, left: 0, right: 100, bottom: top + height, width: 100, height, toJSON() {} };
    });
    vi.mocked(Element.prototype.scrollIntoView).mockImplementation(function scrollIntoView(this: Element) {
      if (this.id === "section-two") safetyTop = 136;
    });

    render(
      <div>
        <SecondaryNavigation
          ariaLabel="On this page"
          items={[
            { kind: "section", id: "one", label: "Overview", targetId: "section-one" },
            { kind: "section", id: "two", label: "Safety", targetId: "section-two" },
          ]}
        />
        <section id="section-one" />
        <section id="section-two" />
      </div>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Safety" }));
    fireEvent.scroll(window);

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Safety" })).toHaveAttribute("aria-current", "location"),
    );
  });

  it("reveals the active item horizontally without overriding motion preferences", async () => {
    document.documentElement.setAttribute("data-motion", "reduced");
    render(
      <SecondaryNavigation
        ariaLabel="Mode"
        activeId="last"
        items={[
          { kind: "action", id: "first", label: "First", onSelect: vi.fn() },
          { kind: "action", id: "last", label: "Last", onSelect: vi.fn() },
        ]}
      />,
    );

    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: "auto",
        block: "nearest",
        inline: "nearest",
      }),
    );
  });
});
