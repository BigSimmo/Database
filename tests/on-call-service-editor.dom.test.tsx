/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceEntryEditor } from "@/components/on-call/service-entry-editor";
import type { ServiceEntry } from "@/lib/on-call/service-model";
const site = { id: "11111111-1111-4111-8111-111111111111", name: "Synthetic selected site" };
const entry: ServiceEntry = {
  id: "22222222-2222-4222-8222-222222222222",
  revision: 3,
  publishedRevision: 2,
  content: {
    siteId: null,
    section: "contacts",
    kind: "operational",
    title: "Service-wide contact",
    body: "Synthetic service guidance",
    phone: "08 5555 0100",
    sources: [{ label: "Official source", url: "https://example.org/source" }],
    orientationPhase: "first_shift",
  },
  publishedContent: null,
  status: "draft",
  authorId: null,
  reviewedBy: null,
  reviewedAt: null,
  reviewComment: "",
  updatedAt: "2026-09-23T00:00:00Z",
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("Service handbook edit preserves intentional empty fields", () => {
  it("keeps an existing null service scope while retaining explicit phone clearing and source removal", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <ServiceEntryEditor entry={entry} sites={[site]} defaultSiteId={site.id} onSave={save} onCancel={() => {}} />,
    );
    expect(screen.getByRole("combobox", { name: "Site" })).toHaveValue("");
    await user.clear(screen.getByRole("textbox", { name: "Phone or extension" }));
    await user.click(screen.getByRole("button", { name: "Remove source 1" }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ entryId: entry.id, expectedRevision: 3, siteId: null, phone: "", sources: [] }),
    );
  });
  it("does not discard or retarget an unsaved entry when the owner declines a switch", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const props = { sites: [site], defaultSiteId: site.id, onSave: save, onCancel: () => {} };
    const view = render(<ServiceEntryEditor {...props} entry={entry} />);
    await user.clear(screen.getByRole("textbox", { name: /^Title/ }));
    await user.type(screen.getByRole("textbox", { name: /^Title/ }), "Unsaved first draft");
    view.rerender(
      <ServiceEntryEditor
        {...props}
        entry={{
          ...entry,
          id: "33333333-3333-4333-8333-333333333333",
          content: { ...entry.content, title: "Other entry" },
        }}
      />,
    );
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox", { name: /^Title/ })).toHaveValue("Unsaved first draft");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ entryId: entry.id, expectedRevision: 3, title: "Unsaved first draft" }),
    );
  });
  it("uses the selected site only for a new entry", () => {
    render(
      <ServiceEntryEditor entry={null} sites={[site]} defaultSiteId={site.id} onSave={vi.fn()} onCancel={() => {}} />,
    );
    expect(screen.getByRole("combobox", { name: "Site" })).toHaveValue(site.id);
  });
});
