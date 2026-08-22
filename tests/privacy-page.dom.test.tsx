/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacyQuietSignalPage } from "@/components/privacy-quiet-signal-page";
import { PRIVACY_SECTIONS } from "@/lib/privacy-page-content";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

/**
 * Scoped to the accordion: the section index renders a button per section too,
 * and only the accordion trigger owns a panel.
 */
function panelFor(heading: string) {
  const trigger = screen
    .getAllByRole("button", { name: new RegExp(heading, "i") })
    .find((candidate) => candidate.getAttribute("aria-controls")?.includes("-panel-"));
  expect(trigger, `no accordion trigger for ${heading}`).toBeTruthy();
  const panelId = (trigger as HTMLElement).getAttribute("aria-controls");
  const panel = document.getElementById(panelId as string);
  expect(panel).not.toBeNull();
  return { trigger: trigger as HTMLElement, panel: panel as HTMLElement };
}

describe("privacy page interaction", () => {
  beforeEach(() => {
    window.location.hash = "";
    // jsdom has no layout, so scrollIntoView is not implemented on the prototype.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("keeps other sections open when one is toggled after Expand all", () => {
    render(<PrivacyQuietSignalPage />);

    fireEvent.click(screen.getByTestId("privacy-expand-all"));
    for (const section of PRIVACY_SECTIONS) {
      expect(panelFor(section.heading).panel.dataset.open).toBe("true");
    }

    // The old single-`openId` model collapsed every other section here.
    fireEvent.click(panelFor("Retention").trigger);
    expect(panelFor("Retention").panel.dataset.open).toBe("false");
    expect(panelFor("Your responsibilities").panel.dataset.open).toBe("true");
    expect(panelFor("Where data is stored and processed").panel.dataset.open).toBe("true");
  });

  it("opens the section named by the URL hash on arrival", () => {
    window.location.hash = "#third-parties";
    render(<PrivacyQuietSignalPage />);

    expect(panelFor("Third parties involved").panel.dataset.open).toBe("true");
  });

  it("opens the explaining section when an at-a-glance fact is selected", () => {
    render(<PrivacyQuietSignalPage />);

    expect(panelFor("External provider processing").panel.dataset.open).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /OpenAI, United States/i }));

    expect(panelFor("External provider processing").panel.dataset.open).toBe("true");
    expect(window.location.hash).toBe("#external-providers");
  });

  it("collapses panels with the hidden utility, never the attribute that beats print", () => {
    render(<PrivacyQuietSignalPage />);

    const { panel } = panelFor("Retention");
    expect(panel.dataset.open).toBe("false");
    expect(panel.hasAttribute("hidden")).toBe(false);
    expect(panel.className).toContain("hidden");
    expect(panel.className).toContain("print:block");
  });

  it("honours reduced motion when scrolling to a section", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    document.documentElement.setAttribute("data-motion", "reduced");

    render(<PrivacyQuietSignalPage />);
    fireEvent.click(screen.getByRole("button", { name: /Never leaves this tab/i }));

    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
    document.documentElement.removeAttribute("data-motion");
  });

  it("describes each collapsed section instead of hiding the summary from assistive tech", () => {
    render(<PrivacyQuietSignalPage />);

    const { trigger } = panelFor("Retention");
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const gist = document.getElementById(describedBy as string);
    expect(gist?.textContent).toContain("30-day queries");
    expect(gist?.getAttribute("aria-hidden")).toBeNull();
  });
});
