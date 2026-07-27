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

describe("PatientSafetyPlan — incomplete-plan draft guard", () => {
  it("flags the patient copy as a draft until every step is complete", async () => {
    const user = userEvent.setup();
    render(<PatientSafetyPlan />);

    // Blank plan — the patient copy is clearly marked a draft.
    expect(screen.getByText(draftPattern)).toBeTruthy();

    // Loading the complete example (all six steps, contacts with reach methods) clears it.
    await user.click(screen.getByRole("button", { name: /Load example/ }));
    expect(screen.queryByText(draftPattern)).toBeNull();
  });

  it("returns to draft when a contact has no way to reach them", async () => {
    const user = userEvent.setup();
    render(<PatientSafetyPlan />);

    await user.click(screen.getByRole("button", { name: /Load example/ }));
    expect(screen.queryByText(draftPattern)).toBeNull();

    // Rebuild the "People I can ask for help" contact step with a name but no phone.
    const supportStep = screen.getByRole("region", { name: "Step 4: People I can ask for help" });
    for (const remove of within(supportStep).getAllByRole("button", { name: /^Remove/ })) {
      await user.click(remove);
    }
    await user.type(within(supportStep).getByLabelText("Name & relationship"), "Sam — a friend");
    await user.click(within(supportStep).getByRole("button", { name: /^Add$/ }));

    // A contact with no reach method leaves the plan incomplete → draft again.
    expect(screen.getByText(draftPattern)).toBeTruthy();
  });
});
