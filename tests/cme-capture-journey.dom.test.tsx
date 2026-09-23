/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CmeEntryRouteClient } from "@/components/cme/cme-entry-route-client";
import { CmeNewEntryRoute } from "@/components/cme/cme-new-entry-route";
import { CmeSetupRoute } from "@/components/cme/cme-setup-route";
import type { CmeRoutine } from "@/lib/cme/routines";
import type { CmeEntry, CmeRequirementSet } from "@/lib/cme/types";

vi.mock("@/components/cme/cme-evidence-panel", () => ({ CmeEvidencePanel: () => <section aria-label="Evidence" /> }));
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, usePathname: () => "/cme/setup" }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  navigation.push.mockReset();
  navigation.refresh.mockReset();
});

const ROUTINE_ID = "22222222-2222-4222-8222-222222222222";
const ENTRY_ID = "33333333-3333-4333-8333-333333333333";
const DOCUMENT_ID = "44444444-4444-4444-8444-444444444444";

const requirementSet: CmeRequirementSet = {
  year: 2025,
  confirmedOn: "2025-01-05",
  confirmedSource: "Owner-checked 2025 guide",
  totalHours: 50,
  requirements: [
    {
      id: "domains",
      label: "Practice domains",
      source: "national",
      completedOn: null,
      spec: { shape: "activity-count", buckets: ["Professionalism"], minimumPerBucket: 1 },
    },
    {
      id: "peer-review",
      label: "Formal peer review",
      source: "college",
      completedOn: null,
      spec: { shape: "credited-hours", credit: "formal-peer-review", minimumHours: 5 },
    },
  ],
};

const routine: CmeRoutine = {
  id: ROUTINE_ID,
  title: "Monthly peer-review group",
  cadence: "monthly",
  usualHours: 1.5,
  usualAllocations: [{ category: "reviewing", hours: 1.5 }],
  nextDue: "2025-09-15",
  archivedAt: null,
};

function jsonResponse(payload: object, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestBody(call: readonly unknown[]) {
  const init = call[1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("CME capture routes", () => {
  it("keeps a failed routine draft and retries the same full request before navigating to its actual year", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "The record could not be saved yet." }, 503))
      .mockResolvedValueOnce(jsonResponse({ entry: { id: ENTRY_ID } }));

    render(<CmeNewEntryRoute routine={routine} set={requirementSet} demoMode={false} />);
    const date = screen.getByLabelText("Date");
    await user.clear(date);
    await user.type(date, "2025-09-15");
    const credit = screen.getByLabelText(/formal peer-review credit/i);
    await user.clear(credit);
    await user.type(credit, "1");
    await user.click(screen.getByRole("checkbox", { name: "Professionalism" }));
    await user.type(screen.getByLabelText("Reflection"), "Compared documentation practice with peers.");
    await user.type(screen.getByLabelText(/what it cost/i), "45.50");
    await user.click(screen.getByRole("button", { name: /save entry/i }));

    expect(await screen.findByText("The record could not be saved yet.")).toBeInTheDocument();
    expect(screen.getByLabelText(/what was it/i)).toHaveValue("Monthly peer-review group");
    expect(screen.getByLabelText("Date")).toHaveValue("2025-09-15");
    expect(screen.getByLabelText(/formal peer-review credit/i)).toHaveValue("1");
    expect(screen.getByRole("checkbox", { name: "Professionalism" })).toBeChecked();
    expect(navigation.push).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /save entry/i }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/cme/log?year=2025"));
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const first = requestBody(fetchMock.mock.calls[0]);
    const retried = requestBody(fetchMock.mock.calls[1]);
    expect(retried).toEqual(first);
    expect(first).toMatchObject({
      date: "2025-09-15",
      title: "Monthly peer-review group",
      allocations: [{ category: "reviewing", hours: 1.5 }],
      reflection: "Compared documentation practice with peers.",
      costCents: 4550,
      routineId: ROUTINE_ID,
      documentId: null,
      buckets: ["Professionalism"],
      formalPeerReviewHours: 1,
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/cme/entries", expect.objectContaining({ method: "POST" }));
  });

  it("sends a complete edit payload and returns to the edited activity", async () => {
    const user = userEvent.setup();
    const entry: CmeEntry = {
      id: ENTRY_ID,
      date: "2025-08-15",
      title: "Peer-review group",
      allocations: [{ category: "reviewing", hours: 1.5 }],
      reflection: "Initial reflection",
      costCents: 2500,
      transcribed: false,
      routineId: ROUTINE_ID,
      documentId: DOCUMENT_ID,
      buckets: [],
      formalPeerReviewHours: 0,
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ entry }));

    render(<CmeEntryRouteClient entry={entry} set={requirementSet} edit demoMode={false} />);
    const title = screen.getByLabelText(/what was it/i);
    await user.clear(title);
    await user.type(title, "Peer-review group — corrected");
    const date = screen.getByLabelText("Date");
    await user.clear(date);
    await user.type(date, "2025-09-16");
    const credit = screen.getByLabelText(/formal peer-review credit/i);
    await user.clear(credit);
    await user.type(credit, "1");
    await user.click(screen.getByRole("checkbox", { name: "Professionalism" }));
    const reflection = screen.getByLabelText("Reflection");
    await user.clear(reflection);
    await user.type(reflection, "Corrected reflection");
    const cost = screen.getByLabelText(/what it cost/i);
    await user.clear(cost);
    await user.type(cost, "45.50");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/cme/log/${ENTRY_ID}`));
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/cme/entries/${ENTRY_ID}`,
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(requestBody(fetchMock.mock.calls[0])).toEqual({
      date: "2025-09-16",
      title: "Peer-review group — corrected",
      allocations: [{ category: "reviewing", hours: 1.5 }],
      reflection: "Corrected reflection",
      costCents: 4550,
      routineId: ROUTINE_ID,
      documentId: DOCUMENT_ID,
      sourceUrl: null,
      buckets: ["Professionalism"],
      formalPeerReviewHours: 1,
      transcribed: false,
    });
  });

  it("retains an edited setup after failure and refreshes only after the full set is confirmed", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ error: "Confirmation is temporarily unavailable." }, 503))
      .mockResolvedValueOnce(jsonResponse({ year: 2025, requirementSet }));

    render(<CmeSetupRoute year={2025} set={requirementSet} demoMode={false} />);
    const source = screen.getByLabelText(/source you checked/i);
    await user.clear(source);
    await user.type(source, "Owner-checked revised 2025 guide");
    await user.click(screen.getByRole("button", { name: /re-confirm requirements/i }));

    expect(await screen.findByText("Confirmation is temporarily unavailable.")).toBeInTheDocument();
    expect(source).toHaveValue("Owner-checked revised 2025 guide");
    expect(navigation.refresh).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /re-confirm requirements/i }));
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/cme/year", expect.objectContaining({ method: "PUT" }));
    const first = requestBody(fetchMock.mock.calls[0]);
    expect(requestBody(fetchMock.mock.calls[1])).toEqual(first);
    expect(first).toEqual({
      ...requirementSet,
      confirmedSource: "Owner-checked revised 2025 guide",
    });
  });
});
