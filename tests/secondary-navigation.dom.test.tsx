import { render, screen, waitFor } from "@testing-library/react";
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
  Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
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
          items={[{ kind: "route", id: "overview", label: "Overview", href: "/overview" }]}
        />
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

  it("keeps active-chip sync on the horizontal rail without scrolling the page", async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      writable: true,
      value: scrollTo,
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
      if (this.classList.contains("polished-scroll")) {
        return { x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 56, width: 200, height: 56, toJSON() {} };
      }
      if (this.textContent === "Safety") {
        return { x: 260, y: 8, top: 8, left: 260, right: 340, bottom: 48, width: 80, height: 40, toJSON() {} };
      }
      return { x: 0, y: 0, top: 0, left: 0, right: 80, bottom: 40, width: 80, height: 40, toJSON() {} };
    });

    const { rerender } = render(
      <SecondaryNavigation
        ariaLabel="On this page"
        sticky={false}
        activeId="one"
        items={[
          { kind: "action", id: "one", label: "Overview", onSelect: vi.fn() },
          { kind: "action", id: "two", label: "Safety", onSelect: vi.fn() },
        ]}
      />,
    );
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    scrollTo.mockClear();

    rerender(
      <SecondaryNavigation
        ariaLabel="On this page"
        sticky={false}
        activeId="two"
        items={[
          { kind: "action", id: "one", label: "Overview", onSelect: vi.fn() },
          { kind: "action", id: "two", label: "Safety", onSelect: vi.fn() },
        ]}
      />,
    );

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: expect.any(Number) })));
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
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

  it("reveals the active item horizontally without overriding motion preferences", async () => {
    document.documentElement.setAttribute("data-motion", "reduced");
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      writable: true,
      value: scrollTo,
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect(this: HTMLElement) {
      if (this.classList.contains("polished-scroll")) {
        return { x: 0, y: 0, top: 0, left: 0, right: 120, bottom: 56, width: 120, height: 56, toJSON() {} };
      }
      if (this.textContent === "Last") {
        return { x: 180, y: 8, top: 8, left: 180, right: 260, bottom: 48, width: 80, height: 40, toJSON() {} };
      }
      return { x: 0, y: 0, top: 0, left: 0, right: 80, bottom: 40, width: 80, height: 40, toJSON() {} };
    });

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
      expect(scrollTo).toHaveBeenCalledWith({
        left: expect.any(Number),
        behavior: "auto",
      }),
    );
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});
