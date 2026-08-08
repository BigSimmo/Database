import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Compass, ShieldCheck, Stethoscope } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InPageNavHeader } from "@/components/in-page-nav/in-page-nav-header";
import { toDocumentSections, type PageSection } from "@/components/in-page-nav/page-section-index";
import { phoneHeaderCollapseAddonSlotId } from "@/lib/mode-home-composer";

/** `PhoneHeaderCollapsePortal` resolves its host only below this breakpoint. */
function stubPhoneBreakpoint(isPhone: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: isPhone && query === "(max-width: 639px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) satisfies MediaQueryList,
  );
}

const sections: PageSection[] = [
  { id: "service-overview", label: "Overview", icon: Stethoscope },
  { id: "service-referral", label: "Referral", icon: Compass },
  { id: "service-verification", label: "Verification", icon: ShieldCheck },
];

function renderHeader(props: Partial<Parameters<typeof InPageNavHeader>[0]> = {}) {
  return render(
    <InPageNavHeader
      back={{ href: "/services", label: "Services" }}
      title="Community Alcohol and Drug Services (CADS) network"
      sections={sections}
      activeId="service-referral"
      onSelectSection={() => undefined}
      testIdPrefix="service"
      {...props}
    />,
  );
}

describe("toDocumentSections", () => {
  it("fills the document-only fields so the shared primitives render unchanged", () => {
    const [first] = toDocumentSections(sections);
    expect(first).toMatchObject({ id: "service-overview", label: "Overview", detail: "", collapsible: false });
  });

  it("splits weight equally when nothing has been measured", () => {
    for (const section of toDocumentSections(sections)) {
      expect(section.weight).toBeCloseTo(1 / 3, 5);
    }
  });

  it("prefers an explicit weight over a measured one", () => {
    // A page that computed its own weights knows something measurement cannot
    // see — a tab panel that is not on screen has no height at all.
    const measured = new Map([["service-overview", 0.9]]);
    const [first] = toDocumentSections([{ ...sections[0]!, weight: 0.25 }, ...sections.slice(1)], measured);
    expect(first!.weight).toBe(0.25);
  });

  it("uses a measured weight when the section declares none", () => {
    const measured = new Map([["service-overview", 0.6]]);
    const [first] = toDocumentSections(sections, measured);
    expect(first!.weight).toBe(0.6);
  });
});

describe("InPageNavHeader", () => {
  afterEach(() => {
    for (const slot of document.querySelectorAll(`#${phoneHeaderCollapseAddonSlotId}`)) slot.remove();
    vi.restoreAllMocks();
  });

  it("renders the template's four slots", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "Back to services" })).toHaveAttribute("href", "/services");
    const trigger = screen.getByTestId("service-section-trigger");
    // Line two names where you are, which the track can place but never label.
    expect(within(trigger).getByText("Referral")).toBeInTheDocument();
    expect(screen.getByTestId("service-detail-header")).toBeInTheDocument();
  });

  it("leaves the page's single h1 to the record body", () => {
    // Information pages keep their large title in the body, so the header title
    // must not be a second heading.
    renderHeader();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("gives the header the h1 when it is the page's only title", () => {
    renderHeader({ titleAs: "h1" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Community Alcohol and Drug Services");
  });

  it("opens the section sheet from the title and reports position", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByTestId("service-section-trigger"));

    const sheet = await screen.findByTestId("service-section-sheet");
    expect(within(sheet).getByText("Referral · 2 of 3")).toBeInTheDocument();
  });

  it("returns focus to the trigger when the section sheet closes", async () => {
    const user = userEvent.setup();
    renderHeader();
    const trigger = screen.getByTestId("service-section-trigger");

    await user.click(trigger);
    await screen.findByTestId("service-section-sheet");
    await user.click(screen.getByRole("button", { name: "Close section list" }));

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("selects a section and closes the sheet in one action", async () => {
    const user = userEvent.setup();
    const selected: string[] = [];
    renderHeader({ onSelectSection: (id) => selected.push(id) });

    await user.click(screen.getByTestId("service-section-trigger"));
    const sheet = await screen.findByTestId("service-section-sheet");
    await user.click(within(sheet).getByRole("button", { name: /Verification/ }));

    expect(selected).toEqual(["service-verification"]);
    await waitFor(() => expect(screen.queryByTestId("service-section-sheet")).toBeNull());
  });

  it("renders no ellipsis when the page has no actions", () => {
    // A control that opens an empty sheet advertises something that is not there.
    renderHeader();
    expect(screen.queryByTestId("service-actions-trigger")).toBeNull();
  });

  it("opens page actions and hands them a way to close the sheet", async () => {
    const user = userEvent.setup();
    renderHeader({
      actionsNoun: "service",
      actions: (close) => (
        <button type="button" onClick={close}>
          Save service
        </button>
      ),
    });

    await user.click(screen.getByRole("button", { name: "Open service actions" }));
    const sheet = await screen.findByTestId("service-actions-sheet");
    await user.click(within(sheet).getByRole("button", { name: "Save service" }));

    await waitFor(() => expect(screen.queryByTestId("service-actions-sheet")).toBeNull());
  });

  it("portals into the universal collapse slot on phones rather than owning a second scroll-hide header", async () => {
    // The contract is one collapse owner per phone header: below `sm` this
    // subtree belongs to the universal header's collapse row.
    stubPhoneBreakpoint(true);
    const slot = document.createElement("div");
    slot.id = phoneHeaderCollapseAddonSlotId;
    document.body.append(slot);

    renderHeader();

    await waitFor(() => expect(slot.querySelector('[data-testid="service-detail-header"]')).not.toBeNull());
  });

  it("stays in page flow above the phone breakpoint", async () => {
    // At `sm+` the same subtree is sticky in its own page position. Portaling it
    // there would move a desktop page header into the shared search chrome.
    stubPhoneBreakpoint(false);
    const slot = document.createElement("div");
    slot.id = phoneHeaderCollapseAddonSlotId;
    document.body.append(slot);

    renderHeader();

    await waitFor(() => expect(screen.getByTestId("service-detail-header")).toBeInTheDocument());
    expect(slot.querySelector('[data-testid="service-detail-header"]')).toBeNull();
  });
});
