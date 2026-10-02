/** @vitest-environment jsdom */

// "Record missing dates": steps through not-recorded checklist items one at a
// time, saving through the same create path as "Add date", advancing only
// once the server confirms, and never pretending to save when it cannot.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecordDatesSheet } from "@/components/admin/renewals/record-dates-sheet";
import { ADMIN_REQUIREMENTS_CATALOGUE } from "@/lib/admin/requirements";
import { complianceFixture } from "./helpers/on-call-entry-fixture";

const ITEMS = ADMIN_REQUIREMENTS_CATALOGUE.slice(0, 3);
const [FIRST, SECOND] = ITEMS;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function savedEntryFor(requirementId: string, extra: Record<string, unknown> = {}) {
  return complianceFixture(
    "Saved row",
    { category: "registration", requirementId, ...extra },
    { slug: `${requirementId}-saved`, id: "00000000-0000-4000-8000-0000000000bb" },
  );
}

function renderSheet(overrides: Partial<Parameters<typeof RecordDatesSheet>[0]> = {}) {
  const props = {
    items: ITEMS,
    readOnly: null,
    onClose: vi.fn(),
    onSaved: vi.fn(),
    onSignIn: vi.fn(),
    onRetryLoad: vi.fn(),
    ...overrides,
  };
  render(<RecordDatesSheet {...props} />);
  return props;
}

function typeDate(value: string) {
  fireEvent.change(screen.getByLabelText("Expiry date"), { target: { value } });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RecordDatesSheet — stepping through", () => {
  it("shows the progress, the item's own catalogue wording, and a formatted echo of the date", () => {
    renderSheet();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.getByTestId("admin-renewals-record-sheet-title")).toHaveTextContent(FIRST.title);
    const wording = FIRST.status === "confirmed" ? FIRST.rule : FIRST.whatIsUnconfirmed;
    expect(screen.getByText(wording as string)).toBeInTheDocument();
    expect(screen.getByTestId("admin-renewals-record-sheet-save")).toBeDisabled();
    typeDate("2027-01-01");
    expect(screen.getByText("Fri 1 Jan 2027")).toBeInTheDocument();
    expect(screen.getByTestId("admin-renewals-record-sheet-save")).not.toBeDisabled();
  });

  it("Save and next POSTs the item's first date, reports it, and advances only after the server confirms", async () => {
    let resolve: (response: Response) => void = () => {};
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValueOnce(new Promise<Response>((done) => (resolve = done)));
    const props = renderSheet();
    typeDate("2027-01-01");
    fireEvent.click(screen.getByTestId("admin-renewals-record-sheet-save"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/on-call/entries");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.details).toMatchObject({ kind: "compliance", requirementId: FIRST.id, expiresOn: "2027-01-01" });
    // Not confirmed yet: still on the first item, nothing reported.
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(props.onSaved).not.toHaveBeenCalled();

    resolve(jsonResponse({ entry: savedEntryFor(FIRST.id, { expiresOn: "2027-01-01" }) }, 201));
    expect(await screen.findByText("2 of 3")).toBeInTheDocument();
    expect(props.onSaved).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("admin-renewals-record-sheet-title")).toHaveTextContent(SECOND.title);
    expect((screen.getByLabelText("Expiry date") as HTMLInputElement).value).toBe("");
  });

  it("Skip moves on without saving anything", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const props = renderSheet();
    fireEvent.click(screen.getByTestId("admin-renewals-record-sheet-skip"));
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it("Not for this job creates the minimal flagged row, with no date", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ entry: savedEntryFor(FIRST.id, { notForThisJob: true }) }, 201));
    const props = renderSheet();
    fireEvent.click(screen.getByTestId("admin-renewals-record-sheet-not-for-this-job"));
    expect(await screen.findByText("2 of 3")).toBeInTheDocument();
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.details).toEqual({
      kind: "compliance",
      category: FIRST.group,
      requirementId: FIRST.id,
      notForThisJob: true,
    });
    expect(props.onSaved).toHaveBeenCalledTimes(1);
  });

  it("a failed save stays on the same item with an inline error and Retry, which sends it again", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ error: "Service unavailable." }, 503))
      .mockResolvedValueOnce(jsonResponse({ entry: savedEntryFor(FIRST.id, { expiresOn: "2027-01-01" }) }, 201));
    const props = renderSheet();
    typeDate("2027-01-01");
    fireEvent.click(screen.getByTestId("admin-renewals-record-sheet-save"));
    const error = await screen.findByTestId("admin-renewals-record-sheet-error");
    expect(error.textContent).toMatch(/Couldn.t save/);
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(props.onSaved).not.toHaveBeenCalled();
    // The typed date is kept for the retry.
    expect((screen.getByLabelText("Expiry date") as HTMLInputElement).value).toBe("2027-01-01");

    fireEvent.click(within(error).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("2 of 3")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(props.onSaved).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("admin-renewals-record-sheet-error")).toBeNull();
  });

  it("retries Not for this job with the same slug, so a lost response cannot add a second flagged row", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ error: "Service unavailable." }, 503))
      .mockResolvedValueOnce(jsonResponse({ error: "Service unavailable." }, 503))
      .mockResolvedValueOnce(jsonResponse({ entry: savedEntryFor(FIRST.id, { notForThisJob: true }) }, 201));
    renderSheet();
    fireEvent.click(screen.getByTestId("admin-renewals-record-sheet-not-for-this-job"));
    const error = await screen.findByTestId("admin-renewals-record-sheet-error");
    fireEvent.click(within(error).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    // A second tap on the button, not Retry, reuses it too.
    await waitFor(() => expect(screen.getByTestId("admin-renewals-record-sheet-not-for-this-job")).toBeEnabled());
    fireEvent.click(screen.getByTestId("admin-renewals-record-sheet-not-for-this-job"));
    expect(await screen.findByText("2 of 3")).toBeInTheDocument();
    const slugs = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).slug);
    expect(slugs).toHaveLength(3);
    expect(new Set(slugs).size).toBe(1);
  });

  it("finishes with a plain summary of what happened", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ entry: savedEntryFor(FIRST.id, { expiresOn: "2027-01-01" }) }, 201))
      .mockResolvedValueOnce(jsonResponse({ entry: savedEntryFor(ITEMS[2].id, { notForThisJob: true }) }, 201));
    const props = renderSheet();
    typeDate("2027-01-01");
    fireEvent.click(screen.getByTestId("admin-renewals-record-sheet-save"));
    await screen.findByText("2 of 3");
    fireEvent.click(screen.getByTestId("admin-renewals-record-sheet-skip"));
    fireEvent.click(screen.getByTestId("admin-renewals-record-sheet-not-for-this-job"));
    const summary = await screen.findByTestId("admin-renewals-record-sheet-summary");
    expect(summary).toHaveTextContent("Recorded 1, skipped 1, 1 not for this job");
    fireEvent.click(screen.getByTestId("admin-renewals-record-sheet-done"));
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe("RecordDatesSheet — when it cannot save", () => {
  it("says example records are read-only and offers no save", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderSheet({ readOnly: "demo" });
    expect(screen.getByText("Example records are read-only.")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-renewals-record-sheet-save")).toBeNull();
    expect(screen.queryByLabelText("Expiry date")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks a signed-out reader to sign in, through the existing sign-in dialog", () => {
    const props = renderSheet({ readOnly: "signed-out" });
    expect(screen.getByText("Sign in to record dates.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("admin-renewals-record-sheet-sign-in"));
    expect(props.onSignIn).toHaveBeenCalled();
    expect(screen.queryByTestId("admin-renewals-record-sheet-save")).toBeNull();
  });
});
