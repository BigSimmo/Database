/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SERVICE = "5e000000-0000-4000-8000-000000000001";
vi.mock("@/components/roster/roster-import-flow", () => ({ splitCsvRows: () => [] }));

import { RosterPublishTab } from "@/components/roster/manage/publish/roster-publish-tab";
import { RosterPublishPreview } from "@/components/roster/manage/publish/roster-publish-preview";
import { compareWithLive } from "@/lib/roster/publish/compare";
import type { RosterOverview } from "@/lib/roster/team/model";

const overview: RosterOverview = {
  service: { id: SERVICE, name: "Example Health Service · General Medicine" },
  me: { role: "manager", grade: "consultant", rotationEndsOn: null },
  latestPublication: null,
  seenLatest: false,
  settings: { swapApproval: "manager", rules: {}, rulesSource: null, payFortnightAnchor: null },
  sites: [],
};
const futureYear = new Date().getUTCFullYear() + 1;
const grid = {
  dates: [`${futureYear}-10-01`, `${futureYear}-10-02`, `${futureYear}-10-03`],
  rows: [{ name: "Locum 1", cells: ["08:00-16:30", "OFF", "OFF"] }],
};
const preview = {
  freshnessToken: "opaque-token",
  assignments: [],
  changes: { swaps: [], openShifts: [] },
  people: [],
  codes: [],
};
const receipt = {
  publicationId: "5e000000-0000-4000-8000-000000000003",
  version: 5,
  swapsCancelled: [],
  changedUserIds: [],
  openShiftIds: [],
  overridesRecorded: [],
};
let fetchMock: ReturnType<typeof vi.fn>;
function chooseFile() {
  fireEvent.change(screen.getByLabelText("Choose a team roster file"), {
    target: {
      files: [
        new File(["invented roster"], "oct.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      ],
    },
  });
}
beforeEach(() => {
  fetchMock = vi.fn(async (input: string) => {
    if (input === "/api/roster/read-file") return Response.json({ grid });
    return Response.json({ code: "roster_publish_requires_update" }, { status: 409 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Roster publication preparation", () => {
  it("shows removed shifts only for the selected named person", () => {
    const live = ["Alex Example", "Sam Example"].map((name, index) => ({
      id: `old-${index}`,
      userId: null,
      name,
      grade: null,
      siteId: null,
      siteName: null,
      startsAt: `2026-10-0${index + 1}T00:00:00Z`,
      endsAt: `2026-10-0${index + 1}T08:00:00Z`,
      shiftCode: "D",
      kind: "day" as const,
    }));
    const comparison = compareWithLive({
      fileRows: [],
      live,
      approvedChanges: [],
      period: { start: "2026-10-01", end: "2026-10-03" },
    });
    render(
      <RosterPublishPreview
        comparison={comparison}
        swapChoices={{}}
        onSwapChoice={vi.fn()}
        openChoices={{}}
        onOpenChoice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Preview" })[0]!);
    expect(screen.getByText("Changes for Alex Example")).toBeInTheDocument();
    expect(screen.getAllByText(/Removed ·/)).toHaveLength(1);
    expect(screen.queryByText(/Fri.*2 Oct/)).toBeNull();
  });
  it("keeps an unknown row visible and disables Publish while the atomic RPC is unavailable", async () => {
    render(<RosterPublishTab serviceId={SERVICE} overview={overview} />);
    chooseFile();
    await screen.findByText("Locum 1");
    expect(screen.getByText(/Rows matched 0 of 1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    await screen.findByText("Publishing needs a small database update first.");
    fireEvent.click(screen.getByRole("button", { name: "Keep as named" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Keep as named" })).toBeNull());
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(
      fetchMock.mock.calls.some(([url, init]) => init?.method === "POST" && String(url).includes("/publish")),
    ).toBe(false);
  });

  it("publishes a sorted file with the reviewed snapshot token through one POST", async () => {
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
      if (input === "/api/roster/read-file") return Response.json({ grid });
      if (init?.method === "POST") return Response.json(receipt);
      return Response.json(preview);
    });
    render(<RosterPublishTab serviceId={SERVICE} overview={overview} />);
    chooseFile();
    await screen.findByText(/Compared with the live roster, including 0 swaps/);
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Keep as named" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByText("Published v5. 0 people have roster updates. 0 open shifts ready.");
    const post = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/publish") && init?.method === "POST",
    );
    expect(post).toBeTruthy();
    const body = JSON.parse(post![1].body as string);
    expect(body.expectedToken).toBe(preview.freshnessToken);
    expect(body.publication.assignments).toHaveLength(1);
    expect(body.publication.assignments[0]).toEqual(expect.objectContaining({ rosterName: "Locum 1", userId: null }));
    expect(body.openShifts).toEqual([]);
    expect(body.overrideChanges).toEqual([]);
    expect(body).not.toHaveProperty("actorId");
  });

  it("invalidates the preview on a stale token and requires a fresh comparison", async () => {
    let previews = 0;
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
      if (input === "/api/roster/read-file") return Response.json({ grid });
      if (init?.method === "POST") return Response.json({ code: "roster_conflict" }, { status: 409 });
      previews += 1;
      return Response.json({ ...preview, freshnessToken: `token-${previews}` });
    });
    render(<RosterPublishTab serviceId={SERVICE} overview={overview} />);
    chooseFile();
    await screen.findByText(/Compared with the live roster, including 0 swaps/);
    fireEvent.click(screen.getByRole("button", { name: "Keep as named" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByText(/The live roster changed. Review the refreshed comparison/);
    await waitFor(() => expect(previews).toBe(2));
    expect(screen.queryByText(/Published v/)).toBeNull();
  });

  it("posts a TBA row as an atomic open shift without a fabricated assignment", async () => {
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
      if (input === "/api/roster/read-file")
        return Response.json({ grid: { ...grid, rows: [{ name: "TBA", cells: ["08:00-16:30", "", ""] }] } });
      if (init?.method === "POST")
        return Response.json({ ...receipt, openShiftIds: ["5e000000-0000-4000-8000-000000000009"] });
      return Response.json(preview);
    });
    render(<RosterPublishTab serviceId={SERVICE} overview={overview} />);
    chooseFile();
    await screen.findByRole("button", { name: "Open shift" });
    fireEvent.click(screen.getByRole("button", { name: "Open shift" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled());
    expect(screen.getByText(/1 open shift to post/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByText(/1 open shift ready/);
    const post = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/publish") && init?.method === "POST",
    );
    const body = JSON.parse(post![1].body as string);
    expect(body.publication.assignments).toEqual([]);
    expect(body.openShifts).toEqual([
      expect.objectContaining({ shiftCode: "08:00-16:30", kind: "day", urgent: false }),
    ]);
  });

  it("routes a changed published duty to Maker instead of undoing its claim directly", async () => {
    const userId = "5e000000-0000-4000-8000-000000000008";
    const assignmentId = "5e000000-0000-4000-8000-000000000007";
    const openShiftId = "5e000000-0000-4000-8000-000000000009";
    const live = {
      id: assignmentId,
      userId,
      name: "Kai Example",
      grade: "registrar",
      siteId: null,
      siteName: null,
      startsAt: `${futureYear}-10-01T00:00:00.000Z`,
      endsAt: `${futureYear}-10-01T08:30:00.000Z`,
      shiftCode: "08:00-16:30",
      kind: "day",
    };
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
      if (input === "/api/roster/read-file")
        return Response.json({ grid: { ...grid, rows: [{ name: "TBA", cells: ["08:00-16:30", "", ""] }] } });
      if (init?.method === "POST")
        return Response.json({
          ...receipt,
          openShiftIds: [openShiftId],
          overridesRecorded: [{ kind: "open", id: openShiftId }],
        });
      return Response.json({
        ...preview,
        assignments: [live],
        changes: {
          swaps: [],
          openShifts: [{ openShiftId, assignmentId, claimedBy: userId, decidedAt: `${futureYear}-09-01T00:00:00Z` }],
        },
      });
    });
    render(<RosterPublishTab serviceId={SERVICE} overview={overview} />);
    chooseFile();
    fireEvent.click(await screen.findByRole("button", { name: "Open shift" }));
    await screen.findByText(/Would undo 1 approved open-shift claim/);
    expect(screen.getByText(/This upload can only publish the first roster/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    const post = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/publish") && init?.method === "POST",
    );
    expect(post).toBeUndefined();
  });

  it("recognises a saved day-off code on the next roster and carries it into publication", async () => {
    const offCode = { code: "OFFX", kind: "off", starts: null, ends: null, label: null };
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
      if (input === "/api/roster/read-file")
        return Response.json({
          grid: { ...grid, rows: [{ name: "Locum 1", cells: ["08:00-16:30", "OFFX", "OFFX"] }] },
        });
      if (init?.method === "POST") return Response.json(receipt);
      return Response.json({ ...preview, codes: [offCode] });
    });
    render(<RosterPublishTab serviceId={SERVICE} overview={overview} />);
    chooseFile();
    await screen.findByText(/Compared with the live roster/);
    expect(screen.queryByText(/Choose 1 code/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Keep as named" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByText(/Published v5/);
    const post = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/publish") && init?.method === "POST",
    );
    const body = JSON.parse(post![1].body as string);
    expect(body.codes).toContainEqual(offCode);
    expect(body.publication.assignments).toHaveLength(1);
  });
});
