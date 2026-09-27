/** @vitest-environment jsdom */

// AdminQuickAddSheet: "Add a renewal" (final design, screens-v3). A free Name
// and Expiry date for a personal item, plus "Start renewing · your recent"
// lead-time chips (fill only, never preselected), Save grey until both
// fields are filled, and a completed save resets the form for next time.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminQuickAddSheet, leadTimeChipLabel } from "@/components/admin/admin-quick-add-sheet";
import { complianceFixture } from "./helpers/on-call-entry-fixture";

vi.mock("@/lib/admin/download-file", () => ({ downloadTextFile: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("leadTimeChipLabel", () => {
  it("reads exact weeks and months in plain words, and anything else in days", () => {
    expect(leadTimeChipLabel(28)).toBe("4 weeks before");
    expect(leadTimeChipLabel(90)).toBe("3 months before");
    expect(leadTimeChipLabel(1)).toBe("1 day before");
    expect(leadTimeChipLabel(5)).toBe("5 days before");
  });
});

describe("AdminQuickAddSheet", () => {
  it("keeps Save grey until both Name and a valid date are filled", () => {
    render(<AdminQuickAddSheet open onClose={vi.fn()} onSaved={vi.fn()} />);
    const sheet = within(screen.getByTestId("admin-quick-add-sheet"));
    const save = sheet.getByTestId("admin-quick-add-save");
    expect(save).toBeDisabled();

    fireEvent.change(sheet.getByLabelText("Name"), { target: { value: "Car registration" } });
    expect(save).toBeDisabled();

    fireEvent.change(sheet.getByLabelText("Expiry date"), { target: { value: "2027-02-01" } });
    expect(save).not.toBeDisabled();
  });

  it("opens with nothing preselected among the lead-time chips", () => {
    render(<AdminQuickAddSheet open onClose={vi.fn()} onSaved={vi.fn()} />);
    const sheet = within(screen.getByTestId("admin-quick-add-sheet"));
    expect(sheet.getByTestId("admin-quick-add-lead-28")).toHaveAttribute("aria-pressed", "false");
    expect(sheet.getByTestId("admin-quick-add-lead-90")).toHaveAttribute("aria-pressed", "false");
    expect(sheet.getByTestId("admin-quick-add-lead-other")).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a recent lead time as an extra chip, and never repeats one already default", () => {
    render(<AdminQuickAddSheet open onClose={vi.fn()} onSaved={vi.fn()} recentLeadTimeDays={[14, 28]} />);
    const sheet = within(screen.getByTestId("admin-quick-add-sheet"));
    expect(sheet.getByTestId("admin-quick-add-lead-14")).toBeInTheDocument();
    // 14 is new, 28 duplicates a default: three chips total, not four.
    expect(sheet.getAllByTestId(/admin-quick-add-lead-\d+$/)).toHaveLength(3);
  });

  it("reveals a numeric field for Other, and selecting it deselects a chip", () => {
    render(<AdminQuickAddSheet open onClose={vi.fn()} onSaved={vi.fn()} />);
    const sheet = within(screen.getByTestId("admin-quick-add-sheet"));
    fireEvent.click(sheet.getByTestId("admin-quick-add-lead-28"));
    expect(sheet.getByTestId("admin-quick-add-lead-28")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(sheet.getByTestId("admin-quick-add-lead-other"));
    expect(sheet.getByTestId("admin-quick-add-lead-28")).toHaveAttribute("aria-pressed", "false");
    expect(sheet.getByLabelText("Days before, to start renewing")).toBeInTheDocument();
  });

  it("creates a personal renewal on save, and resets the form for next time", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          entry: complianceFixture(
            "Car registration",
            { category: "Personal", expiresOn: "2027-02-01" },
            { slug: "car-rego" },
          ),
        }),
      ),
    );
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(<AdminQuickAddSheet open onClose={onClose} onSaved={onSaved} />);
    let sheet = within(screen.getByTestId("admin-quick-add-sheet"));
    fireEvent.change(sheet.getByLabelText("Name"), { target: { value: "Car registration" } });
    fireEvent.change(sheet.getByLabelText("Expiry date"), { target: { value: "2027-02-01" } });
    fireEvent.click(sheet.getByTestId("admin-quick-add-lead-90"));
    fireEvent.click(sheet.getByTestId("admin-quick-add-save"));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/on-call/entries");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.title).toBe("Car registration");
    expect(body.details.category).toBe("Personal");
    expect(body.details.leadTimeDays).toBe(90);

    // A completed save resets the fields for the next "Add a renewal", unlike
    // a dismissed half-filled draft (Addendum A applies to a dismissal, not
    // to a finished transaction).
    rerender(<AdminQuickAddSheet open={false} onClose={onClose} onSaved={onSaved} />);
    rerender(<AdminQuickAddSheet open onClose={onClose} onSaved={onSaved} />);
    sheet = within(screen.getByTestId("admin-quick-add-sheet"));
    expect((sheet.getByLabelText("Name") as HTMLInputElement).value).toBe("");
    expect((sheet.getByLabelText("Expiry date") as HTMLInputElement).value).toBe("");
    expect(sheet.getByTestId("admin-quick-add-lead-90")).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps a dismissed half-filled draft when reopened", () => {
    const { rerender } = render(<AdminQuickAddSheet open onClose={vi.fn()} onSaved={vi.fn()} />);
    let sheet = within(screen.getByTestId("admin-quick-add-sheet"));
    fireEvent.change(sheet.getByLabelText("Name"), { target: { value: "Half typed" } });

    rerender(<AdminQuickAddSheet open={false} onClose={vi.fn()} onSaved={vi.fn()} />);
    rerender(<AdminQuickAddSheet open onClose={vi.fn()} onSaved={vi.fn()} />);
    sheet = within(screen.getByTestId("admin-quick-add-sheet"));
    expect((sheet.getByLabelText("Name") as HTMLInputElement).value).toBe("Half typed");
  });

  it("shows a plain error and keeps the typed values when the save fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Save failed" }), { status: 500 }),
    );
    render(<AdminQuickAddSheet open onClose={vi.fn()} onSaved={vi.fn()} />);
    const sheet = within(screen.getByTestId("admin-quick-add-sheet"));
    fireEvent.change(sheet.getByLabelText("Name"), { target: { value: "Car registration" } });
    fireEvent.change(sheet.getByLabelText("Expiry date"), { target: { value: "2027-02-01" } });
    fireEvent.click(sheet.getByTestId("admin-quick-add-save"));

    await waitFor(() => expect(sheet.getByTestId("admin-quick-add-save")).not.toBeDisabled());
    expect((sheet.getByLabelText("Name") as HTMLInputElement).value).toBe("Car registration");
  });
});
