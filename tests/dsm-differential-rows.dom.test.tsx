import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DsmDiagnosisPage } from "@/components/dsm/dsm-diagnosis-page";
import { dsmDiagnoses, dsmDifferentialParts, resolveDsmDifferential } from "@/lib/dsm";

// This page pulls in the cross-mode links section, which reads auth session
// state it has no provider for under jsdom. Same stub the shared nav contract
// test uses.
vi.mock("@/components/clinical-dashboard/cross-mode-links", () => ({
  CrossModeLinksSection: () => null,
}));

// The nav header's back control calls useRouter. Same stub as
// tests/dsm-comparison-page.dom.test.tsx.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dsm/diagnoses/panic-disorder",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

const panic = dsmDiagnoses.find((diagnosis) => diagnosis.slug === "panic-disorder")!;

function sidebar() {
  return within(screen.getByLabelText("Diagnosis reference summary"));
}

describe("DSM differential rows", () => {
  it("shows the authored discriminator as its own line under the name", () => {
    render(<DsmDiagnosisPage diagnosis={panic} />);
    const list = sidebar();

    // Before this the whole string rendered on one line, so the reason a
    // differential was raised sat behind the name it belonged to.
    expect(list.getByText("Social anxiety disorder")).toBeTruthy();
    expect(list.getByText("expected attacks in social situations")).toBeTruthy();
    expect(list.queryByText("Social anxiety disorder (expected attacks in social situations)")).toBeNull();
  });

  it("gives every row somewhere to go, including rows with no DSM record", () => {
    render(<DsmDiagnosisPage diagnosis={panic} />);
    const list = sidebar();

    // "Medical cause (cardiac, respiratory, endocrine)" names a category, not a
    // record, so it resolved to nothing and used to render as inert text beside
    // linked siblings with nothing to explain the difference.
    const unresolved = panic.differentials.slice(0, 6).find((row) => !resolveDsmDifferential(row));
    expect(unresolved, "fixture no longer contains an unresolved differential").toBeDefined();

    const { name } = dsmDifferentialParts(unresolved!);
    const link = list.getByRole("link", { name: new RegExp(name, "i") });
    expect(link.getAttribute("href")).toBe(`/dsm/search?q=${encodeURIComponent(name)}&run=1`);
  });

  it("offers compare against the diagnosis being read, on each row that resolves", () => {
    render(<DsmDiagnosisPage diagnosis={panic} />);
    const list = sidebar();

    const resolved = panic.differentials.slice(0, 6).find((row) => resolveDsmDifferential(row))!;
    const match = resolveDsmDifferential(resolved)!;
    const { name } = dsmDifferentialParts(resolved);

    const compare = list.getByRole("link", { name: `Compare ${panic.title} with ${name}` });
    // Both ids, in the order the reader is holding them: the page they are on,
    // then the candidate. A compare link carrying only one id would drop the
    // comparison the row exists to offer.
    expect(compare.getAttribute("href")).toBe(
      `/dsm/compare?ids=${encodeURIComponent(panic.slug)},${encodeURIComponent(match.slug)}`,
    );
  });

  it("offers no compare on a row with nothing to compare against", () => {
    render(<DsmDiagnosisPage diagnosis={panic} />);
    const list = sidebar();

    const unresolved = panic.differentials.slice(0, 6).find((row) => !resolveDsmDifferential(row))!;
    const { name } = dsmDifferentialParts(unresolved);
    expect(list.queryByRole("link", { name: `Compare ${panic.title} with ${name}` })).toBeNull();
  });

  it("renders the ICD-10 code as a copy control", () => {
    render(<DsmDiagnosisPage diagnosis={panic} />);
    const button = screen.getByTestId("dsm-icd-copy");
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("aria-label")).toBe(`Copy ICD-10 code ${panic.icd_code}`);
    // A control, not a label: it has to be pressable on a phone.
    expect(button.className).toContain("min-h-tap");
  });
});
