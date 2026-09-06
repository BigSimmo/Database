/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { OnCallEntryEditor, OnCallVerifyButton } from "@/components/on-call/on-call-entry-editor";
import { OnCallFreshnessBadge } from "@/components/on-call/on-call-freshness-badge";
import { onCallEntryFreshness, type OnCallEntry } from "@/lib/on-call/entry-model";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const NOW = new Date("2026-09-04T00:00:00.000Z");

const ED_REGISTRAR: OnCallEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  section: "contacts",
  slug: "ed-registrar",
  title: "ED registrar",
  subtitle: null,
  body: null,
  details: { role: "ED registrar", phone: "0412 345 678" },
  linkedDocumentIds: [],
  tags: ["Emergency Department"],
  isPersonal: false,
  includeOnCard: true,
  sortOrder: 3,
  lastVerifiedAt: new Date("2026-06-01T00:00:00.000Z").toISOString(),
};

const STALE_ANAESTHETIST: OnCallEntry = {
  id: "33333333-3333-4333-8333-333333333333",
  section: "contacts",
  slug: "on-call-anaesthetist",
  title: "On-call anaesthetist",
  subtitle: null,
  body: null,
  details: { role: "On-call anaesthetist", phone: "0400 000 000" },
  linkedDocumentIds: [],
  tags: ["Theatre"],
  isPersonal: false,
  includeOnCard: false,
  sortOrder: 0,
  lastVerifiedAt: new Date("2020-01-01T00:00:00.000Z").toISOString(),
};

describe("OnCallEntryEditor — creating", () => {
  it("posts a new entry with the fields entered and hands the saved entry back", async () => {
    const user = userEvent.setup();
    const created: OnCallEntry = { ...ED_REGISTRAR, id: "22222222-2222-4222-8222-222222222222", slug: "new-registrar" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ entry: created }));
    vi.stubGlobal("fetch", fetchMock);

    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<OnCallEntryEditor open section="contacts" entry={null} onSaved={onSaved} onClose={onClose} />);

    await user.type(screen.getByLabelText(/^Title/), "New registrar");
    await user.type(screen.getByLabelText(/^Role/), "New ED registrar");
    await user.click(screen.getByTestId("on-call-entry-editor-save"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/on-call/entries");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.section).toBe("contacts");
    expect(body.title).toBe("New registrar");
    expect(body.details).toEqual({ role: "New ED registrar" });
    // No id is sent on create — the server assigns it.
    expect(body.id).toBeUndefined();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("OnCallEntryEditor — editing", () => {
  it("sends a PATCH carrying the FULL entry, not just the changed field", async () => {
    const user = userEvent.setup();
    const saved: OnCallEntry = { ...ED_REGISTRAR, subtitle: "Updated" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ entry: saved }));
    vi.stubGlobal("fetch", fetchMock);

    const onSaved = vi.fn();
    render(<OnCallEntryEditor open section="contacts" entry={ED_REGISTRAR} onSaved={onSaved} onClose={vi.fn()} />);

    const subtitleField = screen.getByLabelText("Subtitle");
    await user.type(subtitleField, "Updated");
    await user.click(screen.getByTestId("on-call-entry-editor-save"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/on-call/entries/${ED_REGISTRAR.id}`);
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    // The ruling this editor exists to satisfy: every field round-trips, most
    // importantly the freshness record, even though only the subtitle changed.
    expect(body.lastVerifiedAt).toBe(ED_REGISTRAR.lastVerifiedAt);
    expect(body.sortOrder).toBe(ED_REGISTRAR.sortOrder);
    expect(body.slug).toBe(ED_REGISTRAR.slug);
    expect(body.tags).toEqual(ED_REGISTRAR.tags);
    expect(body.includeOnCard).toBe(ED_REGISTRAR.includeOnCard);
    expect(body.subtitle).toBe("Updated");
    expect(body.details).toEqual(ED_REGISTRAR.details);

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
  });

  it("pre-fills the per-section fields from the entry being edited", () => {
    render(<OnCallEntryEditor open section="contacts" entry={ED_REGISTRAR} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/^Title/)).toHaveValue("ED registrar");
    expect(screen.getByLabelText(/^Role/)).toHaveValue("ED registrar");
    expect(screen.getByLabelText("Direct phone")).toHaveValue("0412 345 678");
  });
});

describe("OnCallEntryEditor — deleting", () => {
  it("guards delete with a ConfirmDialog whose confirm label names the actual entry, then calls DELETE", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ deleted: true, id: ED_REGISTRAR.id }));
    vi.stubGlobal("fetch", fetchMock);

    const onDeleted = vi.fn();
    const onClose = vi.fn();
    render(
      <OnCallEntryEditor
        open
        section="contacts"
        entry={ED_REGISTRAR}
        onSaved={vi.fn()}
        onDeleted={onDeleted}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByTestId("on-call-entry-editor-delete"));

    const dialog = await screen.findByTestId("confirm-dialog");
    // Never "Confirm" — the label names the entry, not a generic verb.
    const confirmButton = within(dialog).getByRole("button", { name: "Delete ED registrar" });
    expect(within(dialog).queryByRole("button", { name: "Confirm" })).toBeNull();

    await user.click(confirmButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/on-call/entries/${ED_REGISTRAR.id}`);
    expect(init.method).toBe("DELETE");

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(ED_REGISTRAR.id));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not offer delete when the caller supplies no onDeleted (create-only use)", () => {
    render(<OnCallEntryEditor open section="contacts" entry={null} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId("on-call-entry-editor-delete")).toBeNull();
  });
});

describe("OnCallEntryEditor — per-section fields follow the chosen section", () => {
  it('shows the contacts-specific fields (Role, Direct phone) for section="contacts"', () => {
    render(<OnCallEntryEditor open section="contacts" entry={null} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/^Role/)).toBeInTheDocument();
    expect(screen.getByLabelText("Direct phone")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Category/)).toBeNull();
    expect(screen.queryByLabelText(/^Trigger/)).toBeNull();
  });

  it('shows the logistics-specific fields (a Category select) for section="logistics", not the contacts fields', () => {
    render(<OnCallEntryEditor open section="logistics" entry={null} onSaved={vi.fn()} onClose={vi.fn()} />);
    const categoryField = screen.getByLabelText(/^Category/);
    expect(categoryField.tagName).toBe("SELECT");
    expect(screen.queryByLabelText(/^Role/)).toBeNull();
    expect(screen.queryByLabelText("Direct phone")).toBeNull();
  });

  it('shows the playbook-specific Trigger field for section="playbook"', () => {
    render(<OnCallEntryEditor open section="playbook" entry={null} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/^Trigger/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Escalation steps/)).toBeInTheDocument();
  });
});

describe("OnCallEntryEditor — validation", () => {
  it("surfaces a required-field validation error through FieldError and does not call the API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<OnCallEntryEditor open section="contacts" entry={null} onSaved={vi.fn()} onClose={vi.fn()} />);

    // Title is filled but the section-required "Role" field is left blank.
    await user.type(screen.getByLabelText(/^Title/), "New registrar");
    await user.click(screen.getByTestId("on-call-entry-editor-save"));

    await waitFor(() => expect(screen.getAllByTestId("field-error").length).toBeGreaterThan(0));
    expect(screen.getByLabelText(/^Role/)).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("OnCallVerifyButton — the one-tap 'still correct' action", () => {
  /** Minimal harness proving the button actually clears the stale badge in the
   *  UI, not just that a callback fires. */
  function VerifyHarness({ initial }: { initial: OnCallEntry }) {
    const [entry, setEntry] = useState(initial);
    return (
      <div>
        <OnCallFreshnessBadge freshness={onCallEntryFreshness(entry, NOW)} />
        <OnCallVerifyButton entry={entry} onVerified={setEntry} />
      </div>
    );
  }

  it("calls the verify route and flips the badge from stale to fresh in one tap", async () => {
    const user = userEvent.setup();
    const verified: OnCallEntry = { ...STALE_ANAESTHETIST, lastVerifiedAt: NOW.toISOString() };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ entry: verified }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VerifyHarness initial={STALE_ANAESTHETIST} />);

    expect(screen.getByTestId("on-call-freshness-badge")).toHaveAttribute("data-freshness-state", "stale");

    await user.click(screen.getByTestId(`on-call-verify-${STALE_ANAESTHETIST.slug}`));

    expect(fetchMock).toHaveBeenCalledWith(`/api/on-call/entries/${STALE_ANAESTHETIST.id}/verify`, { method: "POST" });

    await waitFor(() =>
      expect(screen.getByTestId("on-call-freshness-badge")).toHaveAttribute("data-freshness-state", "fresh"),
    );
  });

  it("shows an inline error and leaves the entry stale when the verify request fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "Server error." }, 500)));

    render(<VerifyHarness initial={STALE_ANAESTHETIST} />);
    await user.click(screen.getByTestId(`on-call-verify-${STALE_ANAESTHETIST.slug}`));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByTestId("on-call-freshness-badge")).toHaveAttribute("data-freshness-state", "stale");
  });
});

describe("OnCallEntryEditor — the in-sheet quick verify for a stale entry", () => {
  it("offers the same one-tap verify action inside the editor when the entry being edited is stale", async () => {
    const user = userEvent.setup();
    const verified: OnCallEntry = { ...STALE_ANAESTHETIST, lastVerifiedAt: new Date().toISOString() };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ entry: verified })));

    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(
      <OnCallEntryEditor open section="contacts" entry={STALE_ANAESTHETIST} onSaved={onSaved} onClose={onClose} />,
    );

    await user.click(screen.getByTestId(`on-call-verify-${STALE_ANAESTHETIST.slug}`));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(verified));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not show the quick verify action for a fresh entry", () => {
    render(<OnCallEntryEditor open section="contacts" entry={ED_REGISTRAR} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId(`on-call-verify-${ED_REGISTRAR.slug}`)).toBeNull();
  });
});

describe("OnCallEntryEditor — accessible name", () => {
  it("names itself after the entry when editing", () => {
    render(<OnCallEntryEditor open section="contacts" entry={ED_REGISTRAR} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Edit ED registrar" })).toBeInTheDocument();
  });

  it("names itself after the section when creating", () => {
    render(<OnCallEntryEditor open section="contacts" entry={null} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Add to Contacts" })).toBeInTheDocument();
  });
});
