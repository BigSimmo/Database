import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CmeMissedSessionsSection, missedReplacementHref } from "@/components/cme/cme-missed-sessions-section";
import type { CmeMissedSession } from "@/lib/cme/missed-sessions";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SESSION: CmeMissedSession = {
  id: "22222222-2222-4222-8222-222222222222",
  occurredOn: "2026-09-20",
  kind: "teaching",
  title: "Weekly registrar teaching",
  minutesLost: 60,
  reason: null,
  replacementEntryId: null,
};

const ENTRY = { id: "33333333-3333-4333-8333-333333333333", title: "Grand round attendance", date: "2026-09-21" };

describe("missedReplacementHref", () => {
  it("links to /cme/new with the session's title and id", () => {
    const href = missedReplacementHref(SESSION);
    expect(href.startsWith("/cme/new?")).toBe(true);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("title")).toBe("Weekly registrar teaching");
    expect(params.get("missed")).toBe(SESSION.id);
  });
});

describe("CmeMissedSessionsSection", () => {
  it("adds a missed session", async () => {
    const user = userEvent.setup();
    const created: CmeMissedSession = {
      ...SESSION,
      id: "44444444-4444-4444-8444-444444444444",
      title: "Fortnightly supervision",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ missedSession: created }), { status: 201 }),
    );
    render(<CmeMissedSessionsSection sessions={[]} entries={[]} />);

    await user.click(screen.getByTestId("cme-missed-add-open"));
    // `fireEvent.change`, not `user.type`: a `type="date"` input sanitises every partial value to
    // "" as it is typed, so it cannot be typed into character by character.
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: "2026-09-22" } });
    await user.type(screen.getByLabelText(/^What was missed/), "Fortnightly supervision");
    await user.clear(screen.getByLabelText(/^Minutes lost/));
    await user.type(screen.getByLabelText(/^Minutes lost/), "45");
    await user.click(screen.getByTestId("cme-missed-add-save"));

    await waitFor(() => expect(screen.getByText("Fortnightly supervision")).toBeInTheDocument());
    const body = JSON.parse(String((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      occurredOn: "2026-09-22",
      kind: "teaching",
      title: "Fortnightly supervision",
      minutesLost: 45,
      reason: null,
    });
  });

  it("links an already-logged activity as the replacement, then unlinks it", async () => {
    const user = userEvent.setup();
    const linked = { ...SESSION, replacementEntryId: ENTRY.id };
    const unlinked = { ...SESSION, replacementEntryId: null };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ missedSession: linked }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ missedSession: unlinked }), { status: 200 }));

    render(<CmeMissedSessionsSection sessions={[SESSION]} entries={[ENTRY]} />);

    const row = screen.getByTestId(`cme-missed-row-${SESSION.id}`);
    await user.click(within(row).getByText("Link an activity you already logged"));
    await user.selectOptions(within(row).getByLabelText("Link an activity you already logged"), ENTRY.id);
    await user.click(within(row).getByRole("button", { name: "Link" }));

    await waitFor(() => expect(within(row).getByText(/Replaced by/)).toBeInTheDocument());
    expect(screen.getByText(/Replaced by/)).toHaveTextContent(ENTRY.title);
    const [, patchInit] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(patchInit).toMatchObject({ method: "PATCH" });
    expect(JSON.parse(String(patchInit.body))).toEqual({ replacementEntryId: ENTRY.id });

    await user.click(within(row).getByRole("button", { name: "Unlink" }));
    await waitFor(() => expect(within(row).queryByText(/Replaced by/)).toBeNull());
    const [, unlinkInit] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(JSON.parse(String(unlinkInit.body))).toEqual({ replacementEntryId: null });
  });

  it("shows a signed-out state with no add control", () => {
    render(<CmeMissedSessionsSection sessions={[]} entries={[]} state="signed-out" />);
    expect(screen.getByTestId("cme-missed-signed-out")).toBeInTheDocument();
    expect(screen.queryByTestId("cme-missed-add-open")).toBeNull();
  });

  it("shows a load-failed state with no add control", () => {
    render(<CmeMissedSessionsSection sessions={[]} entries={[]} state="load-failed" />);
    expect(screen.getByTestId("cme-missed-load-failed")).toBeInTheDocument();
    expect(screen.queryByTestId("cme-missed-add-open")).toBeNull();
  });

  it("hides every mutating control in demo mode", () => {
    render(<CmeMissedSessionsSection sessions={[SESSION]} entries={[]} demoMode />);
    expect(screen.queryByTestId("cme-missed-add-open")).toBeNull();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.queryByText("Delete")).toBeNull();
    expect(screen.queryByText("Log the replacement")).toBeNull();
  });
});
