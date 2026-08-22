import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CaringContactsShell } from "@/components/caring-contacts/workspace/shell";

describe("caring-contacts workspace shell", () => {
  it("renders exactly one h1 and marks the workspace synthetic", () => {
    render(<CaringContactsShell title="Today">content</CaringContactsShell>);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId("caring-contacts-synthetic-marker")).toBeInTheDocument();
  });

  it("keeps the frozen desktop and phone destination sets", () => {
    render(<CaringContactsShell title="Today">content</CaringContactsShell>);
    const desktop = within(screen.getByRole("navigation", { name: "Workspace" }));
    expect(desktop.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Today",
      "Patients",
      "Schedule",
      "Templates",
    ]);
    const phone = within(screen.getByRole("navigation", { name: "Phone workspace" }));
    expect(phone.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Today",
      "Patients",
      "Schedule",
      "More",
    ]);
  });

  it("navigates internally with Link, never a raw anchor to an internal route", () => {
    const { container } = render(<CaringContactsShell title="Today">content</CaringContactsShell>);
    for (const anchor of container.querySelectorAll("a[href^='/']")) {
      expect(anchor.getAttribute("data-internal-link")).toBe("true");
    }
  });

  it("states a reason on every destination that is not built yet", () => {
    render(<CaringContactsShell title="Today">content</CaringContactsShell>);
    for (const control of screen.queryAllByRole("button", { current: false })) {
      if (control.getAttribute("aria-disabled") !== "true") continue;
      expect(control).toHaveAttribute("title", expect.stringContaining("coming soon"));
      expect(control).not.toHaveAttribute("disabled");
      const describedBy = control.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)?.textContent ?? "").not.toBe("");
    }
  });
});
