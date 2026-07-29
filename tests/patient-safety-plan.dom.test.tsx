/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PatientSafetyPlan } from "@/components/patient-safety-plan";

// The tool header renders a NavigationBackButton that reads the router/pathname.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/safety-plan",
}));

const draftPattern = /this plan is incomplete/i;
const examplePattern = /example only|non-working contact numbers/i;
const exampleExportPattern =
  /\*\*\* EXAMPLE — SAMPLE SAFETY PLAN WITH NON-WORKING NUMBERS, NOT FOR PATIENT HANDOVER \*\*\*/;

describe("PatientSafetyPlan — incomplete-plan draft guard", () => {
  it("flags the patient copy as a draft until every step is complete", async () => {
    render(<PatientSafetyPlan />);

    // Blank plan — the patient copy is clearly marked a draft.
    expect(screen.getByText(draftPattern)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Finalise plan/i })).toBeDisabled();
  });

  it("keeps Load example non-shareable so fake crisis numbers cannot look print-ready", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<PatientSafetyPlan />);

    await user.click(screen.getByRole("button", { name: /Load example/ }));

    // Example seed fills every step, but must stay marked as example/draft —
    // SEED includes non-working numbers like 0400 000 000.
    expect(screen.getByText(examplePattern)).toBeTruthy();
    expect(screen.queryByText(/^Ready to share$/)).toBeNull();
    expect(screen.getByText(/Example — not for handover/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Finalise plan/i })).toBeDisabled();
    expect(screen.getAllByText(/0400 000 000/).length).toBeGreaterThan(0);

    // Date-only edits must not clear the example guard while seeded contacts remain.
    await user.type(screen.getByLabelText(/Plan date/i), "12 Aug 2026");
    expect(screen.getByText(examplePattern)).toBeTruthy();
    expect(screen.queryByText(/^Ready to share$/)).toBeNull();
    expect(screen.getByRole("button", { name: /Finalise plan/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /^Copy$/ }));
    const copied = String(writeText.mock.calls[0]?.[0] ?? "");
    expect(copied).toMatch(exampleExportPattern);
    expect(copied).toContain("0400 000 000");
    expect(copied.startsWith("*** EXAMPLE")).toBe(true);
  });

  it("keeps example mode while seeded rows remain after a partial contact edit", async () => {
    const user = userEvent.setup();
    render(<PatientSafetyPlan />);

    await user.click(screen.getByRole("button", { name: /Load example/ }));
    expect(screen.getByText(examplePattern)).toBeTruthy();

    // Rebuild the "People I can ask for help" contact step with a name but no phone.
    // Other seeded steps still contain SEED rows, so example mode must stay on.
    const supportStep = screen.getByRole("region", { name: "Step 4: People I can ask for help" });
    for (const remove of within(supportStep).getAllByRole("button", { name: /^Remove/ })) {
      await user.click(remove);
    }
    await user.type(within(supportStep).getByLabelText("Name & relationship"), "Sam — a friend");
    await user.click(within(supportStep).getByRole("button", { name: /^Add$/ }));

    expect(screen.getByText(examplePattern)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Finalise plan/i })).toBeDisabled();
  });

  it("marks an incomplete contact plan as a draft once every seeded row is gone", async () => {
    const user = userEvent.setup();
    render(<PatientSafetyPlan />);

    await user.click(screen.getByRole("button", { name: /Load example/ }));
    await user.click(screen.getByRole("button", { name: /Clear all/ }));

    const supportStep = screen.getByRole("region", { name: "Step 4: People I can ask for help" });
    await user.type(within(supportStep).getByLabelText("Name & relationship"), "Sam — a friend");
    await user.click(within(supportStep).getByRole("button", { name: /^Add$/ }));

    expect(screen.getByText(draftPattern)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Finalise plan/i })).toBeDisabled();
  });

  it("marks copied text as a draft when the plan is incomplete", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<PatientSafetyPlan />);
    expect(screen.getByText(draftPattern)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^Copy$/ }));
    expect(writeText).toHaveBeenCalled();
    const copied = String(writeText.mock.calls[0]?.[0] ?? "");
    expect(copied).toMatch(/\*\*\* DRAFT — INCOMPLETE SAFETY PLAN, NOT FOR PATIENT HANDOVER \*\*\*/);
  });
});
