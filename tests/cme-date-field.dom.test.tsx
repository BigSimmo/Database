import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { CmeDateField, type CmeDateFieldProps } from "@/components/cme/cme-date-field";

const TODAY = "2026-09-26";

function Harness({
  initial,
  spy,
  label = "Date",
  ...props
}: Omit<CmeDateFieldProps, "value" | "onChange" | "today" | "label"> & {
  initial: string;
  spy: (iso: string) => void;
  label?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CmeDateField
        label={label}
        id="when"
        today={TODAY}
        value={value}
        onChange={(iso) => {
          spy(iso);
          setValue(iso);
        }}
        {...props}
      />
      <button type="button" onClick={() => setValue("2026-01-02")}>
        Restore
      </button>
    </>
  );
}

describe("CmeDateField with day chips", () => {
  it("shows Today, Yesterday and Other date, with Today chosen for today's date", () => {
    render(<Harness initial={TODAY} spy={vi.fn()} />);
    const group = screen.getByRole("group", { name: "Date" });
    const chips = within(group).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(["Today", "Yesterday", "Other date"]);
    expect(screen.getByTestId("when-today")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("when-yesterday")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByPlaceholderText("dd/mm/yyyy")).toBeNull();
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it("sets yesterday's Perth date from the Yesterday chip", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial={TODAY} spy={spy} />);
    await user.click(screen.getByTestId("when-yesterday"));
    expect(spy).toHaveBeenLastCalledWith("2026-09-25");
    expect(screen.getByTestId("when-yesterday")).toHaveAttribute("aria-pressed", "true");
  });

  it("takes any other day as dd/mm/yyyy and names it on the chip", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial={TODAY} spy={spy} />);
    await user.click(screen.getByTestId("when-other"));
    const input = screen.getByLabelText(/^Date/);
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(input).toHaveAttribute("placeholder", "dd/mm/yyyy");
    expect(input).toHaveAttribute("type", "text");
    await user.clear(input);
    await user.type(input, "3/9/2026");
    await user.tab();
    expect(spy).toHaveBeenLastCalledWith("2026-09-03");
    expect(input).toHaveValue("03/09/2026");
    expect(screen.getByTestId("when-other")).toHaveTextContent("Thu 3 Sep");
    expect(screen.getByTestId("when-other")).toHaveAttribute("aria-pressed", "true");
  });

  it("says so, and keeps no date, when the typed day does not exist", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial={TODAY} spy={spy} required />);
    await user.click(screen.getByTestId("when-other"));
    const input = screen.getByLabelText(/^Date/);
    await user.clear(input);
    await user.type(input, "31/2/2026");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("Type day/month/year, like 26/09/2026 or 26092026.");
    expect(spy).toHaveBeenLastCalledWith("");
    expect(input).toHaveValue("31/2/2026");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("holds a typed day as soon as it is complete, before the box loses focus", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial={TODAY} spy={spy} required />);
    await user.click(screen.getByTestId("when-other"));
    const input = screen.getByLabelText(/^Date/);
    await user.clear(input);
    await user.type(input, "3/9/202");
    // Half typed: a required field holds no date, so a Save now cannot save the old one.
    expect(spy).toHaveBeenLastCalledWith("");
    await user.type(input, "6");
    // Complete: held at once, with no blur, so a Save tapped now saves 3 September.
    expect(spy).toHaveBeenLastCalledWith("2026-09-03");
    expect(input).toHaveFocus();
  });

  it("refuses a day after today when future days are not allowed", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial={TODAY} spy={spy} required allowFuture={false} />);
    await user.click(screen.getByTestId("when-other"));
    const input = screen.getByLabelText(/^Date/);
    await user.clear(input);
    await user.type(input, "27/09/2026");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose today or an earlier day.");
    expect(spy).not.toHaveBeenCalledWith("2026-09-27");
  });

  it("opens on Other with the date shown when the value is another day, and follows a value set from outside", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2025-12-31" spy={vi.fn()} />);
    expect(screen.getByTestId("when-other")).toHaveTextContent("Wed 31 Dec 2025");
    expect(screen.getByLabelText(/^Date/)).toHaveValue("31/12/2025");
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(screen.getByLabelText(/^Date/)).toHaveValue("02/01/2026");
    expect(screen.getByTestId("when-other")).toHaveTextContent("Fri 2 Jan");
  });

  it("draws 36 px chips inside 48 px tap areas", () => {
    render(<Harness initial={TODAY} spy={vi.fn()} />);
    const chip = screen.getByTestId("when-today");
    expect(chip.className).toMatch(/\bmin-h-tap\b/);
    const surface = chip.querySelector("[data-cme-chip-surface]");
    expect(surface?.className).toMatch(/\binset-y-1\.5\b/);
    expect(surface?.className).toMatch(/\brounded-sm\b/);
    expect(surface?.className).toMatch(/--clinical-accent-soft/);
  });

  it("carries the ISO value in a hidden input when named", () => {
    render(<Harness initial={TODAY} spy={vi.fn()} name="occurredOn" />);
    expect(document.querySelector('input[type="hidden"][name="occurredOn"]')).toHaveValue(TODAY);
  });
});

describe("CmeDateField without chips", () => {
  it("shows only a labelled dd/mm/yyyy box", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial="" spy={spy} chips={false} label="Next due" />);
    expect(screen.queryByTestId("when-today")).toBeNull();
    const input = screen.getByLabelText("Next due");
    expect(input).toHaveAttribute("id", "when");
    await user.type(input, "1 Dec 2026");
    await user.tab();
    expect(spy).toHaveBeenLastCalledWith("2026-12-01");
    expect(input).toHaveValue("01/12/2026");
  });

  it("clears an optional date when the box is emptied", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial="2026-12-01" spy={spy} chips={false} />);
    const input = screen.getByLabelText("Date");
    await user.clear(input);
    await user.tab();
    expect(spy).toHaveBeenLastCalledWith("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps an optional date's value while a typo shows its message", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness initial="2026-12-01" spy={spy} chips={false} />);
    const input = screen.getByLabelText("Date");
    await user.clear(input);
    await user.type(input, "12/31/2026");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("Type day/month/year");
    expect(spy).not.toHaveBeenCalled();
  });
});
