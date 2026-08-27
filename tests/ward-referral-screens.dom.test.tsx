import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

// Same reason as every sibling dom suite (ward-discharge-board.dom.test.tsx,
// ward-handover.dom.test.tsx, ward-ed-screen.dom.test.tsx): `ClinicalRail` renders next/link
// anchors and this suite never checks routing, so a plain <a> avoids an App Router context
// jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { COHORTS, HOME_REGIONS, REFERRAL_SOURCES } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

/** Mirrors `ward-discharge-board.dom.test.tsx`'s own harness pattern: a real reducer-backed
 *  count, read off shared context, so a test can prove a dispatch actually happened (or did
 *  not) rather than only inspecting what the form's own DOM renders. */
function RejectionCount() {
  const { rejections } = useWardFlow();
  return <span data-testid="rejection-count">{rejections.length}</span>;
}

function renderForm() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralIntakeForm />
      <RejectionCount />
    </WardFlowProvider>,
  );
}

const EXPECTED_FIELD_TESTIDS = [
  "ward-referral-intake-ageBand",
  "ward-referral-intake-sex",
  "ward-referral-intake-homeRegion",
  "ward-referral-intake-secureBedNeeded",
  "ward-referral-intake-involuntaryBedNeeded",
  "ward-referral-intake-source",
  "ward-referral-intake-urgency",
  "ward-referral-intake-originSiteCode",
  "ward-referral-intake-transportNeeded",
];

function optionValues(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole("option")
    .map((option) => (option as HTMLOptionElement).value);
}

describe("ReferralIntakeForm", () => {
  it("renders exactly one control for every field the model permits, and nothing else", () => {
    renderForm();

    for (const testId of EXPECTED_FIELD_TESTIDS) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
    expect(screen.getByTestId("ward-referral-intake-submit")).toBeInTheDocument();

    // Every data-testid on the page is unique — a duplicate is a guaranteed strict-mode
    // failure in the browser test (this already happened once this phase). getByTestId
    // itself throws on more than one match, so a bare call for each id above already proves
    // uniqueness for those; this asserts it for the DOM as a whole too.
    const { container } = renderForm();
    const ids = Array.from(container.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no free-text input of any kind anywhere on the form", () => {
    renderForm();

    const form = screen.getByTestId("ward-referral-intake-form");
    const freeTextControls = form.querySelectorAll(
      'input[type="text"], input[type="search"], input[type="email"], input:not([type]), textarea, [contenteditable="true"]',
    );
    expect(freeTextControls).toHaveLength(0);
  });

  it("offers every age band from COHORTS — the four-time defect class this phase keeps hitting", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-ageBand");
    expect(optionValues(select)).toEqual([...COHORTS]);
  });

  it("offers every home region from HOME_REGIONS", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-homeRegion");
    expect(optionValues(select)).toEqual([...HOME_REGIONS]);
  });

  it("offers every referral source from REFERRAL_SOURCES", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-source");
    expect(optionValues(select)).toEqual([...REFERRAL_SOURCES]);
  });

  it("offers every real network site as an origin option", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-originSiteCode");
    expect(optionValues(select)).toEqual(wardSites.map((site) => site.code));
  });

  it("offers both sexes", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-sex");
    expect(optionValues(select)).toEqual(["Female", "Male"]);
  });

  it("offers all three urgency tiers", () => {
    renderForm();

    const select = screen.getByTestId("ward-referral-intake-urgency");
    expect(optionValues(select)).toEqual(["1", "2", "3"]);
  });

  it("describes the request, never the person, for the two need toggles", () => {
    renderForm();

    // The wording rule: "needs a secure bed", never "is a risk"; "needs a bed that can hold
    // someone involuntarily", never "is involuntary" — the requirement attaches to the
    // request, the word never attaches to the person.
    expect(screen.getByText(/needs a secure bed/i)).toBeInTheDocument();
    expect(screen.getByText(/needs a bed that can hold someone involuntarily/i)).toBeInTheDocument();
    expect(screen.queryByText(/\bis involuntary\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bis a risk\b/i)).not.toBeInTheDocument();
  });

  it("submits a well-formed referral with no rejection, using the fixed community role", () => {
    renderForm();

    fireEvent.click(screen.getByTestId("ward-referral-intake-submit"));

    expect(screen.getByTestId("rejection-count")).toHaveTextContent("0");
    expect(screen.queryByTestId("ward-referral-intake-rejection")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-referral-intake-confirmation")).toBeInTheDocument();
  });

  it("surfaces a visible Rejection, rather than swallowing it, when the reducer refuses the intake", () => {
    renderForm();

    // No option on the real network carries an empty code, so setting the origin site select
    // to a value with no matching <option> leaves the DOM's own resolved value at "" (per the
    // HTMLSelectElement value-setter algorithm: no matching option -> selectedIndex -1 ->
    // value ""). `siteByCode("")` then resolves to nothing, and RECEIVE_REFERRAL's own
    // membership check (ward-flow-reducer.ts) refuses the event — a real reducer refusal, not
    // a fabricated one.
    fireEvent.change(screen.getByTestId("ward-referral-intake-originSiteCode"), {
      target: { value: "no-such-site" },
    });
    fireEvent.click(screen.getByTestId("ward-referral-intake-submit"));

    expect(screen.getByTestId("rejection-count")).toHaveTextContent("1");
    const rejection = screen.getByTestId("ward-referral-intake-rejection");
    expect(rejection).toBeInTheDocument();
    expect(rejection).toHaveTextContent(/must resolve to a real site/i);
    expect(screen.queryByTestId("ward-referral-intake-confirmation")).not.toBeInTheDocument();
  });
});
