import { describe, expect, it, vi } from "vitest";
import { cmeCsvCell, formatCmeYearCsv, activeCmeYearEntries } from "@/lib/cme/export";
import { evaluateYear, totalAllocatedHours } from "@/lib/cme/evaluate";
import { formatEntryForCpdHome } from "@/lib/cme/clipboard";
import { normalizeCmeSourceUrl, parseCmeLearningPrefill } from "@/lib/cme/learning-source";
import { setCmeEntryArchived, fetchOwnerCmeEntries } from "@/lib/cme/repository";
import { createAustralianRanzcpPreset } from "@/lib/cme/presets";
import type { CmeEntry } from "@/lib/cme/types";
const entry: CmeEntry = {
  id: "a",
  date: "2026-01-01",
  title: "Synthetic activity",
  allocations: [{ category: "reviewing", hours: 2 }],
  formalPeerReviewHours: 1,
  reflection: "Line one\nLine two",
  costCents: 12345,
  transcribed: false,
  routineId: null,
  documentId: null,
  buckets: ["Ethical practice"],
  sourceUrl: "https://example.org/learning",
};
const set = createAustralianRanzcpPreset(2026, "2026-01-01");
describe("CME archived accounting and exports", () => {
  it("excludes archived and other years while keeping category hours and peer subset distinct", () => {
    const archived = { ...entry, id: "b", title: "Archived secret", archivedAt: "2026-09-01T00:00:00Z" };
    const older = { ...entry, id: "c", date: "2025-12-31", title: "Prior year" };
    expect(totalAllocatedHours([entry, archived])).toBe(2);
    const status = evaluateYear({ set, entries: [entry, archived] });
    expect(status.totalHours).toBe(2);
    expect(activeCmeYearEntries([older, archived, entry], 2026)).toEqual([entry]);
    const csv = formatCmeYearCsv([older, archived, entry], set);
    expect(csv).not.toContain("Archived secret");
    expect(csv).not.toContain("Prior year");
    expect(csv).toContain('"2026-01-01","Synthetic activity","2","0","2","0","1"');
    expect(csv).toContain('"123.45"');
    expect(csv).toContain("Source URL (not evidence)");
    expect(() => formatEntryForCpdHome(archived, set)).toThrow(/Restore/);
  });
  it.each(["=HYPERLINK(1)", " +1", "\t@SUM(1)", "-1+2", "\rplain"])("neutralizes spreadsheet command %s", (value) =>
    expect(cmeCsvCell(value)).toBe(`"'${value.replaceAll('"', '""')}"`),
  );
  it("escapes comma, quote and multiline fields without shifting cells", () =>
    expect(cmeCsvCell('a,"b"\nc')).toBe('"a,""b""\nc"'));
  it("passes archive owner only from its server argument and maps closed-year failures safely", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "a",
        activity_date: entry.date,
        title: entry.title,
        archived_at: "2026-09-01T00:00:00Z",
        cme_allocations: entry.allocations,
      },
      error: null,
    });
    const saved = await setCmeEntryArchived({ rpc } as never, "owner", "a", true);
    expect(saved.archivedAt).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith("cme_set_entry_archived", {
      p_owner_id: "owner",
      p_entry_id: "a",
      p_archived: true,
    });
    rpc.mockResolvedValue({ data: null, error: { message: "cme_year_closed" } } as never);
    await expect(setCmeEntryArchived({ rpc } as never, "owner", "a", false)).rejects.toThrow(/closed/);
  });
  it("filters archives by default, permits explicit archive reads and refuses partial oversized years", async () => {
    let data: unknown[] = [
      { id: "a", activity_date: entry.date, title: entry.title, cme_allocations: [] },
      { id: "b", activity_date: entry.date, title: "Archived", archived_at: "now", cme_allocations: [] },
    ];
    const chain = {
      select: () => chain,
      eq: vi.fn(() => chain),
      order: () => chain,
      limit: () => Promise.resolve({ data, error: null, count: data.length }),
    };
    const client = { from: () => chain };
    expect((await fetchOwnerCmeEntries(client as never, "owner", "year")).map((e) => e.id)).toEqual(["a"]);
    expect(await fetchOwnerCmeEntries(client as never, "owner", "year", { includeArchived: true })).toHaveLength(2);
    expect(chain.eq).toHaveBeenCalledWith("owner_id", "owner");
    chain.limit = () => Promise.resolve({ data, error: null, count: 1001 });
    await expect(fetchOwnerCmeEntries(client as never, "owner", "year")).rejects.toThrow(/complete record/);
    chain.limit = () => Promise.resolve({ data, error: null, count: data.length });
    data = Array.from({ length: 2001 }, () => ({}));
    await expect(fetchOwnerCmeEntries(client as never, "owner", "year")).rejects.toThrow(/complete record/);
  });
});
describe("Learning prefill accepts no passive duration or unsafe source", () => {
  it.each([
    "javascript:alert(1)",
    "//example.org",
    "https://user:pass@example.org",
    "/\\example.org",
    "data:text/html,x",
  ])("rejects %s", (url) => expect(normalizeCmeSourceUrl(url)).toBeNull());
  it("bounds inputs and admits only title/source fields", () => {
    expect(parseCmeLearningPrefill({ title: "x".repeat(201), sourceUrl: ["https://example.org"] })).toEqual({});
    expect(parseCmeLearningPrefill({ title: " A handbook page ", sourceUrl: "/on-call/handbook#topic" })).toEqual({
      title: "A handbook page",
      sourceUrl: "/on-call/handbook#topic",
    });
  });
});
