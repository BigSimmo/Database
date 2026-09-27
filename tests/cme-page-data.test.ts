import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  demo: vi.fn(),
  server: vi.fn(),
  admin: vi.fn(),
  year: vi.fn(),
  entries: vi.fn(),
  entry: vi.fn(),
  routines: vi.fn(),
  evidenceCounts: vi.fn(),
  planGoals: vi.fn(),
  entryGoals: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isDemoMode: mocks.demo }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/cme/evidence-repository", () => ({ fetchCmeEvidenceCounts: mocks.evidenceCounts }));
// Plan goals are read beside the entries; an empty plan leaves every assertion below unchanged.
vi.mock("@/lib/cme/plan-goals-repository", () => ({
  fetchOwnerCmePlanGoals: mocks.planGoals,
  fetchOwnerCmeEntryGoals: mocks.entryGoals,
}));
vi.mock("@/lib/cme/repository", () => ({
  fetchOwnerCmeYear: mocks.year,
  fetchOwnerCmeEntries: mocks.entries,
  fetchOwnerCmeEntry: mocks.entry,
  fetchOwnerCmeRoutines: mocks.routines,
}));
import { loadCmePageData, loadCmeEntryPageData } from "@/lib/cme/load-cme-page-data";
import { createAustralianRanzcpPreset } from "@/lib/cme/presets";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.admin.mockReturnValue({});
  mocks.server.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } }, error: null }) },
  });
  mocks.year.mockResolvedValue(null);
  mocks.entries.mockResolvedValue([]);
  mocks.routines.mockResolvedValue([]);
  mocks.entry.mockResolvedValue(null);
  mocks.evidenceCounts.mockResolvedValue({});
  mocks.planGoals.mockResolvedValue([]);
  mocks.entryGoals.mockResolvedValue({});
});
describe("CME page state is honest and owner-scoped", () => {
  it("distinguishes signed-out from unconfigured", async () => {
    mocks.server.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    });
    expect((await loadCmePageData(2025)).state).toBe("signed-out");
    expect(mocks.year).not.toHaveBeenCalled();
  });
  it("distinguishes unavailable configuration from missing year", async () => {
    mocks.server.mockResolvedValue(null);
    expect((await loadCmePageData(2025)).state).toBe("unavailable");
    expect(mocks.year).not.toHaveBeenCalled();
  });
  it("does not invite setup after database/auth failures", async () => {
    mocks.year.mockRejectedValue(new Error("private connection details"));
    const data = await loadCmePageData(2025);
    expect(data.state).toBe("unavailable");
    expect(JSON.stringify(data)).not.toContain("private connection");
    mocks.server.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError" } }),
      },
    });
    expect((await loadCmePageData()).state).toBe("unavailable");
  });
  it("returns routines alongside an unconfigured year without using demo records", async () => {
    mocks.routines.mockResolvedValue([{ id: "routine" }]);
    const data = await loadCmePageData(2025);
    expect(data.state).toBe("unconfigured");
    expect(data.demoMode).toBe(false);
    expect(data.entries).toEqual([]);
    expect(data.routines).toEqual([{ id: "routine" }]);
    expect(mocks.year).toHaveBeenCalledWith({}, "owner", 2025);
  });
  it("resolves an entry from its own year rather than assuming the current year", async () => {
    mocks.entry.mockResolvedValue({ id: "entry", date: "2024-02-29" });
    mocks.year.mockResolvedValue({ id: "year-2024", ...createAustralianRanzcpPreset(2024, "2024-01-02") });
    const data = await loadCmeEntryPageData("entry");
    expect(data.state).toBe("ready");
    expect(data.year).toBe(2024);
    expect(data.entry?.id).toBe("entry");
    expect(mocks.entry).toHaveBeenCalledWith({}, "owner", "entry");
    expect(mocks.year).toHaveBeenCalledWith({}, "owner", 2024);
    expect(mocks.entries).toHaveBeenCalledWith({}, "owner", "year-2024", {});
  });
  it("preserves historical entries and settings when a legacy year has no requirements", async () => {
    const legacy = { id: "legacy-year", ...createAustralianRanzcpPreset(2024, "2024-01-02"), requirements: [] };
    const historicalEntry = { id: "old-entry", date: "2024-02-29" };
    mocks.year.mockResolvedValue(legacy);
    mocks.entry.mockResolvedValue(historicalEntry);
    mocks.entries.mockResolvedValue([historicalEntry]);
    mocks.routines.mockResolvedValue([{ id: "routine" }]);
    const data = await loadCmeEntryPageData("old-entry");
    expect(data.state).toBe("unconfigured");
    expect(data.set).toEqual(legacy);
    expect(data.entries).toEqual([{ ...historicalEntry, evidenceCount: 0 }]);
    expect(data.entry).toEqual({ ...historicalEntry, evidenceCount: 0 });
    expect(data.routines).toEqual([{ id: "routine" }]);
    expect(data.year).toBe(2024);
  });
  it.each([{ confirmedSource: "  " }, { confirmedOn: "2026-02-30" }, { confirmedOn: "" }])(
    "requires explicit reconfirmation for incomplete provenance %j",
    async (invalidProvenance) => {
      const stored = { id: "year", ...createAustralianRanzcpPreset(2026, "2026-01-02"), ...invalidProvenance };
      mocks.year.mockResolvedValue(stored);
      mocks.entries.mockResolvedValue([{ id: "existing-entry" }]);
      const data = await loadCmePageData(2026);
      expect(data.state).toBe("unconfigured");
      expect(data.set).toEqual(stored);
      expect(data.entries).toEqual([{ id: "existing-entry", evidenceCount: 0 }]);
    },
  );
  it("does not present corrupted requirement data as a clean setup opportunity", async () => {
    mocks.year.mockResolvedValue({
      id: "year",
      ...createAustralianRanzcpPreset(2026, "2026-01-02"),
      requirements: [
        { id: "broken", label: "Saved target", source: "college", completedOn: null, spec: { shape: "unknown" } },
      ],
    });
    const data = await loadCmePageData(2026);
    expect(data.state).toBe("unavailable");
    expect(data.set).toBeNull();
  });
  it("keeps a failed history read unavailable even when the year itself needs setup repair", async () => {
    mocks.year.mockResolvedValue({
      id: "legacy-year",
      ...createAustralianRanzcpPreset(2026, "2026-01-02"),
      requirements: [],
    });
    mocks.entries.mockRejectedValue(new Error("History read failed"));
    expect((await loadCmePageData(2026)).state).toBe("unavailable");
  });
  it("returns missing owner-scoped entry as null", async () => {
    expect((await loadCmeEntryPageData("other-owner-entry")).entry).toBeNull();
    expect(mocks.entry).toHaveBeenCalledWith({}, "owner", "other-owner-entry");
  });
  it("counts uploaded evidence separately from source links and fails honestly if counts are unavailable", async () => {
    mocks.year.mockResolvedValue({ id: "year", ...createAustralianRanzcpPreset(2026, "2026-01-02") });
    mocks.entries.mockResolvedValue([
      { id: "reading", sourceUrl: "https://example.com/source" },
      { id: "certificate" },
    ]);
    mocks.evidenceCounts.mockResolvedValue({ certificate: 2 });
    const data = await loadCmePageData(2026);
    expect(data.entries.map((entry) => entry.evidenceCount)).toEqual([0, 2]);
    expect(mocks.evidenceCounts).toHaveBeenCalledWith({}, "owner", 2026);
    mocks.evidenceCounts.mockRejectedValue(new Error("Unavailable"));
    expect((await loadCmePageData(2026)).state).toBe("unavailable");
  });
  it("reads the year's entries, evidence counts and plan goals side by side, not one after another", async () => {
    mocks.year.mockResolvedValue({ id: "year", ...createAustralianRanzcpPreset(2026, "2026-01-02") });
    const entriesRead: { release?: () => void } = {};
    mocks.entries.mockImplementation(
      () =>
        new Promise((resolve) => {
          entriesRead.release = () => resolve([{ id: "entry" }]);
        }),
    );
    const loading = loadCmePageData(2026);
    await vi.waitFor(() => expect(mocks.entries).toHaveBeenCalled());
    // Each read crosses Singapore -> Sydney; these must not wait for the entry list.
    expect(mocks.evidenceCounts).toHaveBeenCalled();
    expect(mocks.planGoals).toHaveBeenCalled();
    expect(mocks.entryGoals).not.toHaveBeenCalled();
    entriesRead.release?.();
    const data = await loading;
    expect(data.state).toBe("ready");
    expect(mocks.entryGoals).toHaveBeenCalledWith({}, "owner", ["entry"]);
  });
});
