import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CmeDashboard } from "@/components/cme/cme-dashboard";
import { CmeEntryForm } from "@/components/cme/cme-entry-form";
import { DEMO_CME_ENTRIES, DEMO_CME_YEAR } from "@/lib/cme/demo-year";
import { cmeDraftPayloadSchema } from "@/lib/cme/drafts";

describe("saving an activity as a draft", () => {
  it("offers Save as draft only when the page supports it", () => {
    render(<CmeEntryForm onSubmit={vi.fn()} />);
    expect(screen.queryByTestId("cme-entry-save-draft")).toBeNull();
  });

  it("saves a half-filled form that could not yet be saved as an activity", async () => {
    const onSaveDraft = vi.fn().mockResolvedValue(undefined);
    const onSubmit = vi.fn();
    render(<CmeEntryForm onSubmit={onSubmit} onSaveDraft={onSaveDraft} />);
    const user = userEvent.setup();
    expect(screen.getByTestId("cme-entry-save-draft")).toBeDisabled();
    await user.type(screen.getByLabelText(/what was it/i), "Supervision with Dr A");
    // No category chosen, so the activity itself cannot save yet.
    expect(screen.getByRole("button", { name: /save entry/i })).toBeDisabled();
    await user.click(screen.getByTestId("cme-entry-save-draft"));
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1));
    expect(onSubmit).not.toHaveBeenCalled();
    const payload = onSaveDraft.mock.calls[0]![0];
    expect(payload.title).toBe("Supervision with Dr A");
    expect(payload.mode).toBeNull();
    expect(cmeDraftPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("shows why a draft could not be saved and keeps the fields", async () => {
    const onSaveDraft = vi.fn().mockRejectedValue(new Error("Draft service down."));
    render(<CmeEntryForm onSubmit={vi.fn()} onSaveDraft={onSaveDraft} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/what was it/i), "Case conference");
    await user.click(screen.getByTestId("cme-entry-save-draft"));
    expect(await screen.findByText("Draft service down.")).toBeInTheDocument();
    expect(screen.getByLabelText(/what was it/i)).toHaveValue("Case conference");
  });

  it("continues a saved draft with its own fields", async () => {
    const initialDraft = cmeDraftPayloadSchema.parse({
      title: "Balint group",
      date: "2026-03-04",
      statedHoursText: "1.5",
      mode: "reviewing",
      reflection: "Half written",
    });
    render(<CmeEntryForm onSubmit={vi.fn()} onSaveDraft={vi.fn()} initialDraft={initialDraft} />);
    await waitFor(() => expect(screen.getByLabelText(/what was it/i)).toHaveValue("Balint group"));
    expect(screen.getByLabelText(/^date/i)).toHaveValue("2026-03-04");
    expect(screen.getByLabelText(/reflection/i)).toHaveValue("Half written");
    expect(screen.getByRole("button", { name: /save entry/i })).toBeEnabled();
    // The tab's "we kept your unsaved entry" notice is not shown for an account draft.
    expect(screen.queryByTestId("cme-entry-draft-restored")).toBeNull();
  });
});

describe("the dashboard Next row", () => {
  const now = new Date("2026-06-15T02:00:00Z");

  it("puts drafts to finish first when there are any", () => {
    render(<CmeDashboard set={DEMO_CME_YEAR} entries={DEMO_CME_ENTRIES} now={now} draftsToFinish={2} />);
    const link = screen.getByTestId("cme-drafts-to-finish");
    expect(link).toHaveTextContent("Drafts to finish: 2 activities");
    expect(link).toHaveAttribute("href", "/cme/log#cme-drafts");
    expect(link.compareDocumentPosition(screen.getByTestId("cme-next-action"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("says nothing about drafts when there are none", () => {
    render(<CmeDashboard set={DEMO_CME_YEAR} entries={DEMO_CME_ENTRIES} now={now} />);
    expect(screen.queryByTestId("cme-drafts-to-finish")).toBeNull();
  });
});
