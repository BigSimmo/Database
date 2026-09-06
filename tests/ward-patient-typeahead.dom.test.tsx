import { readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

/*
 * D7 — THE COMPONENT HAD NO TESTS AT ALL. This file is that guard, for the six other verified
 * defects (D1-D6) an independent reviewer found in `patient-typeahead.tsx` /
 * `patient-typeahead.module.css` at HEAD `164915e78`. Every test below was written and watched
 * RED against the pre-fix code, then GREEN against the fix — see the commit history for this file.
 *
 * Same reason as every sibling dom suite (`ward-patient-search.dom.test.tsx` and others): `Link`
 * renders next/link anchors and jsdom has no App Router context to give it, so a plain `<a>` stands
 * in.
 */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PatientTypeahead } from "@/components/ward-management/search/patient-typeahead";
import type { Referral } from "@/components/ward-management/ward-model";
import { findPatients } from "@/components/ward-management/ward-patients";
import type { PatientId } from "@/components/ward-management/ward-patients";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { referralState } from "@/components/ward-management/ward-referrals";
import { referrals as seedReferrals } from "@/components/ward-management/ward-movements";

/*
 * jsdom loads no stylesheet and computes no layout — `getComputedStyle().borderColor` etc. return
 * "" for a CSS Modules class regardless of what the file says. D3 (hover vs keyboard-active must
 * look different) and D6 (the active row must survive forced-colors) are both facts about the
 * STYLESHEET SOURCE, not about anything jsdom can render, so they are asserted directly against the
 * file text below rather than through the DOM. Normalised to LF, same as every other suite in this
 * repo that reads a module.css file (`tests/ward-chrome-owner.test.ts`), so a working tree that has
 * picked up CRLF fails on its CONTENT rather than on line endings the guard never meant to check.
 */
const CSS_PATH = path.resolve(
  __dirname,
  "..",
  "src",
  "components",
  "ward-management",
  "search",
  "patient-typeahead.module.css",
);
const cssSource = readFileSync(CSS_PATH, "utf8").split("\r\n").join("\n");

/** Three referrals, one per `ReferralState`, built by cloning real seeded referrals (RF-001
 *  queued, RF-002 accepted, RF-004 declined — `ward-movements.ts`) rather than hand-building the
 *  dozen required `Referral` fields. Only `id` and `patientId` are overridden, so every other field
 *  stays a value this repository already ships. */
function referralFor(template: Referral, id: string, patientId: PatientId): Referral {
  return { ...template, id, patientId };
}

const QUEUED_REFERRAL = referralFor(seedReferrals[0], "RF-TEST-QUEUED", "PT-001");
const ACCEPTED_REFERRAL = referralFor(seedReferrals[1], "RF-TEST-ACCEPTED", "PT-002");
const DECLINED_REFERRAL = referralFor(seedReferrals[3], "RF-TEST-DECLINED", "PT-003");

// Precondition, not the finding: prove the three fixtures actually exercise the three states
// `referralState` can return, before trusting anything rendered from them.
describe("test fixtures", () => {
  it("cover all three ReferralStates", () => {
    expect(referralState(QUEUED_REFERRAL)).toBe("queued");
    expect(referralState(ACCEPTED_REFERRAL)).toBe("accepted");
    expect(referralState(DECLINED_REFERRAL)).toBe("declined");
  });
});

/** Controlled wrapper — `PatientTypeahead` takes `value`/`onValueChange`, so every test needs a
 *  small stateful host rather than a bare render. */
function Harness(props: Omit<ComponentProps<typeof PatientTypeahead>, "value" | "onValueChange">) {
  const [value, setValue] = useState("");
  return <PatientTypeahead {...props} value={value} onValueChange={setValue} />;
}

function getInput() {
  return screen.getByTestId("ward-patient-typeahead-input");
}

describe("PatientTypeahead — D1: the active option scrolls into view", () => {
  it("scrolls the option ArrowDown/End moved to, using block: 'nearest', not merely the popup opening", () => {
    // Predict, before running: typing "a" matches every seeded patient (checked directly below
    // rather than assumed, per the brief's own example) — the failure case the reviewer found is
    // pressing End on a list long enough that the popup clips it.
    const matches = findPatients(wardPatients, "a");
    expect(matches, '"a" must match every seeded patient for this test to exercise the clipped case').toHaveLength(
      wardPatients.length,
    );

    const scrollSpy = vi.fn();
    // jsdom implements no scrollIntoView at all; the component guards the call with `?.`, so
    // nothing breaks in suites that never touch this — this spy exists only to observe the call.
    Element.prototype.scrollIntoView = scrollSpy;

    render(<Harness patients={wardPatients} referrals={[]} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.keyDown(input, { key: "End" });

    const lastPatient = matches[matches.length - 1];
    const expectedEl = screen.getByTestId(`ward-patient-typeahead-option-${lastPatient.id}`);

    expect(scrollSpy).toHaveBeenCalled();
    // `mock.contexts` records `this` at call time — proves it scrolled THIS row, not merely that
    // something on the page called scrollIntoView.
    expect(scrollSpy.mock.contexts.at(-1)).toBe(expectedEl);
    expect(scrollSpy.mock.calls.at(-1)?.[0]).toMatchObject({ block: "nearest" });
  });
});

describe("PatientTypeahead — D2: activeIndex does not survive an outside click", () => {
  it("clears the active row on an outside click, so a refocus-then-Enter cannot pick an unread patient", () => {
    const onPick = vi.fn();
    render(
      <div>
        <Harness patients={wardPatients} referrals={[]} onPick={onPick} />
        <button type="button" data-testid="outside">
          elsewhere on the page
        </button>
      </div>,
    );
    const input = getInput();
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" }); // a row is now active

    // The outside click closes the popup — this is the reviewer's reproduction step, not the
    // assertion; D2 is about what state survives it.
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByTestId("ward-patient-typeahead-popup")).not.toBeInTheDocument();

    // Refocusing reopens it. Nothing must be preselected — the component's own documented promise.
    fireEvent.focus(input);
    const popup = screen.getByTestId("ward-patient-typeahead-popup");
    expect(within(popup).queryByRole("option", { selected: true })).not.toBeInTheDocument();

    // And Enter, reached out of habit, must not commit anybody.
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe("PatientTypeahead — D3: hover and keyboard-active are visually distinct", () => {
  it("no longer shares one selector list between :hover and .optionActive", () => {
    // The exact shape of the original defect: a single rule with both selectors in its comma list.
    const sharedRule = /\.option:hover\s*,\s*\.optionActive|\.optionActive\s*,\s*\.option:hover/;
    expect(sharedRule.test(cssSource)).toBe(false);
  });

  it("gives the keyboard-active row a channel the hover row does not carry", () => {
    const hoverBlock = cssSource.match(/(?<![.\w])\.option:hover\s*\{([^}]*)\}/);
    const activeBlock = cssSource.match(/\.option\.optionActive\s*\{([^}]*)\}/);
    expect(hoverBlock, "no .option:hover rule found").not.toBeNull();
    expect(activeBlock, "no .option.optionActive rule found").not.toBeNull();

    // Assert the CLAIM (an extra channel exists on the row Enter will actually pick), not any
    // particular wording: the active block declares a box-shadow the hover block does not.
    expect(activeBlock?.[1]).toMatch(/box-shadow/);
    expect(hoverBlock?.[1]).not.toMatch(/box-shadow/);
  });
});

describe("PatientTypeahead — D4: the referral line matches the actual referral state", () => {
  it("names accepted/declined/queued distinctly, and never claims a decided referral is still waiting", () => {
    render(<Harness patients={wardPatients} referrals={[QUEUED_REFERRAL, ACCEPTED_REFERRAL, DECLINED_REFERRAL]} />);
    const input = getInput();

    fireEvent.change(input, { target: { value: "Halloway" } });
    const queuedRow = screen.getByTestId("ward-patient-typeahead-option-PT-001");
    expect(within(queuedRow).getByText(/waiting for a decision/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "Hallowin" } });
    const acceptedRow = screen.getByTestId("ward-patient-typeahead-option-PT-002");
    // The defect: this used to read "waiting for a decision" regardless of state. It must not, for
    // a referral that has actually been accepted.
    expect(within(acceptedRow).queryByText(/waiting for a decision/i)).not.toBeInTheDocument();
    expect(within(acceptedRow).getByText(new RegExp(ACCEPTED_REFERRAL.id))).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "Marrowby" } });
    const declinedRow = screen.getByTestId("ward-patient-typeahead-option-PT-003");
    expect(within(declinedRow).queryByText(/waiting for a decision/i)).not.toBeInTheDocument();
    expect(within(declinedRow).getByText(new RegExp(DECLINED_REFERRAL.id))).toBeInTheDocument();
  });

  it("says a referral is not LINKED, never that none exists, when nothing points at this patient", () => {
    render(<Harness patients={wardPatients} referrals={[]} />);
    fireEvent.change(getInput(), { target: { value: "Halloway" } });
    const row = screen.getByTestId("ward-patient-typeahead-option-PT-001");

    // The overclaim the defect made: "on record" reads as "this person has no referral", a fact
    // about the world this component cannot see (patientId is an optional, mostly-unset pointer).
    expect(within(row).queryByText(/no referral on record/i)).not.toBeInTheDocument();
    expect(within(row).getByText(/no referral.*linked/i)).toBeInTheDocument();
  });
});

describe("PatientTypeahead — D5: nearPatients receives every term in the query", () => {
  it("finds a near-spelling surname when typed alongside its correct given name", () => {
    // Precondition: "Talia Hallowey" must not be an exact match, or this test would not exercise
    // the near-spelling path at all.
    expect(findPatients(wardPatients, "Talia Hallowey")).toHaveLength(0);

    render(<Harness patients={wardPatients} referrals={[]} />);
    fireEvent.change(getInput(), { target: { value: "Talia Hallowey" } });

    // The defect: passed as one combined term, this returned nothing and claimed no name was one
    // keystroke away. "hallowey"/"halloway" (PT-001) is a single substitution apart.
    expect(screen.queryByText(/no name is one keystroke away/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-patient-typeahead-option-PT-001")).toBeInTheDocument();
  });
});

describe("PatientTypeahead — D6: the active row survives forced-colors", () => {
  it("carries a @media (forced-colors: active) block for the active row", () => {
    expect(cssSource).toMatch(/@media \(forced-colors: active\)/);
  });

  it("pins an explicit system colour AND changes the border WIDTH, not hue alone", () => {
    const forcedBlock = cssSource.match(/@media \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/);
    expect(forcedBlock, "no forced-colors block found").not.toBeNull();
    const body = forcedBlock?.[1] ?? "";

    expect(body).toMatch(/\.option\.optionActive/);
    // A width explicitly stated in the forced-colors override, not merely a colour keyword — the
    // finding was specifically that colour ALONE carried the active row.
    expect(body).toMatch(/border:\s*[\d.]+(rem|px|em)\s+solid\s+Highlight/);
  });
});
