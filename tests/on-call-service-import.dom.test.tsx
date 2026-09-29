/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceImportPanel } from "@/components/on-call/service-import-panel";
import type { ServiceEntry } from "@/lib/on-call/service-model";

// Synthetic ids and numbers only (plan GC9).
const SITE = "30000000-0000-4000-8000-00000000000a";
const SERVICE = "20000000-0000-4000-8000-000000000001";
const ENTRY = "40000000-0000-4000-8000-000000000001";

function draft(
  id: string,
  over: Partial<ServiceEntry> = {},
  kind: ServiceEntry["content"]["kind"] = "operational",
): ServiceEntry {
  const content = {
    siteId: SITE,
    section: "contacts" as const,
    kind,
    title: `Row ${id.slice(-4)}`,
    body: "Synthetic example only",
    phone: "9000 0001",
    sources:
      kind === "operational"
        ? []
        : [{ label: "Synthetic hospital policy", url: "https://example.org/synthetic-policy" }],
    orientationPhase: "first_shift" as const,
  };
  return {
    id,
    revision: 2,
    publishedRevision: null,
    content,
    publishedContent: null,
    status: "draft",
    authorId: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: "",
    updatedAt: "2026-09-20T04:00:00.000Z",
    ...over,
  };
}

function posts() {
  return vi.mocked(globalThis.fetch).mock.calls.filter(([, init]) => init?.method === "POST");
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ServiceImportPanel", () => {
  it("previews a CSV, saves only ticked rows as drafts, then reloads once", async () => {
    const reload = vi.fn(async () => {});
    render(
      <ServiceImportPanel
        serviceId={SERVICE}
        siteId={SITE}
        siteName="Site A"
        authEpoch={1}
        detail={{ entries: [] }}
        demo={false}
        reload={reload}
        sleep={async () => {}}
      />,
    );
    const file = new File(["title,phone\nWard: Synthetic ward 4B,4401\nICU: Registrar,4456\n"], "numbers.csv", {
      type: "text/csv",
    });
    await userEvent.upload(screen.getByLabelText("Choose a CSV file"), file);
    const rows = await within(await screen.findByRole("table")).findAllByRole("checkbox");
    expect(rows).toHaveLength(2);
    expect(rows.every((box) => !(box as HTMLInputElement).checked)).toBe(true);
    expect(screen.queryByRole("checkbox", { name: /publish/i })).toBeNull();
    await userEvent.click(rows[1]!);
    await userEvent.click(screen.getByRole("button", { name: "Save 1 ticked row as a draft" }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(String(posts()[0]?.[1]?.body))).toMatchObject({
      action: "entry.save",
      title: "ICU: Registrar",
      publish: false,
    });
    expect(screen.getByText("Saved 1 draft.")).toBeInTheDocument();
  });

  it("previews how each number will dial", async () => {
    render(
      <ServiceImportPanel
        serviceId={SERVICE}
        siteId={SITE}
        siteName="Site A"
        authEpoch={1}
        detail={{ entries: [] }}
        demo={false}
        reload={vi.fn()}
      />,
    );
    await userEvent.upload(
      screen.getByLabelText("Choose a CSV file"),
      new File(['title,phone\nA,9000 0002\nB,4456\nC,"9000 0000, 4455"\nD,ask at desk\n'], "n.csv", {
        type: "text/csv",
      }),
    );
    const table = await screen.findByRole("table");
    for (const text of ["Call", "From a hospital phone", "Call then ext 4455", "Text"]) {
      expect(within(table).getByText(text)).toBeInTheDocument();
    }
  });

  it("shows an update as the old number struck through beside the new one", async () => {
    const existing = {
      ...draft(ENTRY, { status: "published", revision: 3 }),
      content: { ...draft(ENTRY).content, title: "Switchboard", phone: "9000 0000" },
    };
    render(
      <ServiceImportPanel
        serviceId={SERVICE}
        siteId={SITE}
        siteName="Site A"
        authEpoch={1}
        detail={{ entries: [existing] }}
        demo={false}
        reload={vi.fn()}
        sleep={async () => {}}
      />,
    );
    await userEvent.upload(
      screen.getByLabelText("Choose a CSV file"),
      new File(["title,phone\nSwitchboard,9000 0001\n"], "n.csv", { type: "text/csv" }),
    );
    const old = within(await screen.findByRole("table")).getByText("9000 0000");
    expect(old.tagName).toBe("DEL");
    expect(old.className).not.toMatch(/danger|success|warning/);
  });

  it("disables the tick of a row the server would refuse, and says why", async () => {
    render(
      <ServiceImportPanel
        serviceId={SERVICE}
        siteId={SITE}
        siteName="Site A"
        authEpoch={1}
        detail={{ entries: [] }}
        demo={false}
        reload={vi.fn()}
      />,
    );
    await userEvent.upload(
      screen.getByLabelText("Choose a CSV file"),
      new File([`title,phone,name\n${"x".repeat(161)},4456,Dr Example\nOK,4457,Dr Example\n`], "n.csv", {
        type: "text/csv",
      }),
    );
    const boxes = await within(await screen.findByRole("table")).findAllByRole("checkbox");
    expect(boxes[0]).toBeDisabled();
    expect(within(screen.getByRole("table")).getByText(/160/)).toBeInTheDocument();
    expect(screen.queryByText("Dr Example")).toBeNull();
    expect(screen.getByText(/Person names are not imported yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tick all that can be saved" }));
    expect((boxes[1] as HTMLInputElement).checked).toBe(true);
    expect((boxes[0] as HTMLInputElement).checked).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Clear ticks" }));
    expect((boxes[1] as HTMLInputElement).checked).toBe(false);
  });

  it("publishes ticked drafts in a batch of at most 20, after telling the editor to dial a few", async () => {
    const drafts = Array.from({ length: 21 }, (_, index) =>
      draft(`40000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
    );
    const reload = vi.fn(async () => {});
    render(
      <ServiceImportPanel
        serviceId={SERVICE}
        siteId={SITE}
        siteName="Site A"
        authEpoch={1}
        detail={{ entries: drafts }}
        demo={false}
        reload={reload}
        sleep={async () => {}}
      />,
    );
    const publish = screen.getByTestId("service-import-publish");
    expect(publish).toHaveTextContent("Dial two or three of these before you publish.");
    await userEvent.click(within(publish).getByRole("button", { name: "Tick the next 20" }));
    await userEvent.click(within(publish).getByRole("button", { name: "Publish 20" }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    const bodies = vi.mocked(globalThis.fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies).toHaveLength(20);
    expect(bodies.every((body) => body.publish === true && body.expectedRevision === 2)).toBe(true);
  });

  it("will not publish more than 20 at once", async () => {
    const drafts = Array.from({ length: 21 }, (_, index) =>
      draft(`40000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
    );
    render(
      <ServiceImportPanel
        serviceId={SERVICE}
        siteId={SITE}
        siteName="Site A"
        authEpoch={1}
        detail={{ entries: drafts }}
        demo={false}
        reload={vi.fn()}
      />,
    );
    const publish = screen.getByTestId("service-import-publish");
    await userEvent.click(within(publish).getByRole("button", { name: "Show all 21" }));
    for (const box of within(publish).getAllByRole("checkbox")) await userEvent.click(box);
    expect(within(publish).getByRole("button", { name: "Publish at most 20 at a time" })).toBeDisabled();
  });

  it("gives each draft a real call link and lists no clinical drafts", async () => {
    const clinical = draft("40000000-0000-4000-8000-000000000009", {}, "clinical");
    render(
      <ServiceImportPanel
        serviceId={SERVICE}
        siteId={SITE}
        siteName="Site A"
        authEpoch={1}
        detail={{ entries: [draft(ENTRY), clinical] }}
        demo={false}
        reload={vi.fn()}
      />,
    );
    const publish = screen.getByTestId("service-import-publish");
    expect(within(publish).getByRole("link", { name: /^Call Row 0001/ })).toHaveAttribute("href", "tel:0890000001");
    expect(within(publish).queryByText(clinical.content.title)).toBeNull();
    expect(publish).toHaveTextContent("Clinical and legal drafts go through review on the Handbook tab.");
  });

  it("saves nothing in demo mode", async () => {
    render(
      <ServiceImportPanel
        serviceId={SERVICE}
        siteId={SITE}
        siteName="Site A"
        authEpoch={1}
        detail={{ entries: [draft(ENTRY)] }}
        demo
        reload={vi.fn()}
      />,
    );
    await userEvent.upload(
      screen.getByLabelText("Choose a CSV file"),
      new File(["title,phone\nA,4401\n"], "n.csv", { type: "text/csv" }),
    );
    await screen.findByRole("table");
    const buttons = screen.getAllByRole("button", { name: "Demo mode saves nothing" });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button).toBeDisabled();
  });

  it("warns against patient details and staff names before any file is chosen", () => {
    render(
      <ServiceImportPanel
        serviceId={SERVICE}
        siteId={SITE}
        siteName="Site A"
        authEpoch={1}
        detail={{ entries: [] }}
        demo={false}
        reload={vi.fn()}
      />,
    );
    expect(screen.getByText(/Do not include patient details or staff names/)).toBeInTheDocument();
    expect(screen.getByText("Rows are saved as drafts. Nobody sees them until you publish below.")).toBeInTheDocument();
  });
});
