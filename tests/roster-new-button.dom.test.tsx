/** @vitest-environment jsdom */

import { CalendarPlus, FileUp, Plane } from "lucide-react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { RosterNewButton, type RosterNewEntry } from "@/components/roster/roster-new-button";

afterEach(() => cleanup());

function entries(onShift = vi.fn()): RosterNewEntry[] {
  return [
    { id: "shift", label: "Add a shift", description: "Can repeat weekly", icon: CalendarPlus, onSelect: onShift },
    { id: "requests", label: "Plan leave", icon: Plane, href: "/roster/requests?start=leave" },
    { id: "import", label: "Import a file", icon: FileUp, disabled: { reason: "Sign in to import a roster" } },
  ];
}

it("opens one sheet named New that lists every entry", () => {
  render(<RosterNewButton entries={entries()} />);
  fireEvent.click(screen.getByRole("button", { name: "New" }));
  expect(screen.getByRole("dialog", { name: "New" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Add a shift/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Plan leave/ })).toHaveAttribute("href", "/roster/requests?start=leave");
});

it("runs an entry's handler and closes the sheet", () => {
  const onShift = vi.fn();
  render(<RosterNewButton entries={entries(onShift)} />);
  fireEvent.click(screen.getByRole("button", { name: "New" }));
  fireEvent.click(screen.getByRole("button", { name: /Add a shift/ }));
  expect(onShift).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog", { name: "New" })).toBeNull();
});

it("keeps an unavailable entry focusable, states why, and does nothing on tap", () => {
  render(<RosterNewButton entries={entries()} />);
  fireEvent.click(screen.getByRole("button", { name: "New" }));
  const row = screen.getByRole("button", { name: /Import a file/ });
  expect(row).toHaveAttribute("aria-disabled", "true");
  expect(row).not.toBeDisabled();
  expect(row).toHaveAccessibleDescription("Sign in to import a roster");
  fireEvent.click(row);
  expect(screen.getByRole("dialog", { name: "New" })).toBeInTheDocument();
});

it("uses the host's label", () => {
  render(<RosterNewButton entries={entries()} label="New request" testId="requests-new" />);
  expect(screen.getByTestId("requests-new")).toHaveTextContent("New request");
});
