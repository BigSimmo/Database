import { describe, expect, it, vi } from "vitest";

import {
  HANDBOOK_PUBLISH_BATCH_MAX,
  handbookImportIgnoredLine,
  importExistingFrom,
  parseHandbookImportCsv,
  publishDraftBatch,
  publishableDrafts,
  readCsv,
  saveTickedRows,
  toEntrySave,
  toPublishSave,
  type HandbookImportExisting,
} from "@/lib/on-call/handbook-import";
import { serviceActionSchema, type ServiceEntry } from "@/lib/on-call/service-model";

// Synthetic ids and numbers only (plan GC9): 9000 00xx lines and made-up extensions.
const SITE = "30000000-0000-4000-8000-00000000000a";
const OTHER_SITE = "30000000-0000-4000-8000-00000000000b";
const SERVICE = "20000000-0000-4000-8000-000000000001";
const ENTRY = "40000000-0000-4000-8000-000000000001";
const SWITCHBOARD: HandbookImportExisting = {
  id: ENTRY,
  revision: 3,
  title: "Switchboard",
  phone: "9000 0000",
  body: "Synthetic example only",
  kind: "operational",
  sources: [],
  orientationPhase: "first_shift",
};
const base = { section: "contacts" as const, existing: [SWITCHBOARD] };

function draft(
  id: string,
  over: Partial<ServiceEntry> = {},
  kind: ServiceEntry["content"]["kind"] = "operational",
): ServiceEntry {
  const content = {
    siteId: SITE,
    section: "contacts" as const,
    kind,
    title: `Row ${id}`,
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

describe("readCsv", () => {
  it("reads quoted commas, quoted newlines, doubled quotes, a BOM and CRLF", () => {
    expect(readCsv('﻿title,notes\r\n"Ward 4B, east","Level 3\nlift B"\r\n"Say ""ward""",x\r\n')).toEqual([
      ["title", "notes"],
      ["Ward 4B, east", "Level 3\nlift B"],
      ['Say "ward"', "x"],
    ]);
  });

  it("keeps a final record with no trailing newline and an empty last cell", () => {
    expect(readCsv("a,b\n1,")).toEqual([
      ["a", "b"],
      ["1", ""],
    ]);
  });
});

describe("parseHandbookImportCsv", () => {
  it("builds team-prefixed titles and previews how each number will dial", () => {
    const { rows } = parseHandbookImportCsv(
      'Team,Role,Phone,Phone type\nIntensive care,Registrar,4456,extension\nMedicine,Registrar on call,"9000 0000, 4455",landline\n',
      base,
    );
    expect(rows.map((row) => [row.title, row.dial.kind, row.phoneType])).toEqual([
      ["ICU: Registrar", "extension", "extension"],
      ["Medicine: Registrar on call", "switchboard-extension", "landline"],
    ]);
    expect(rows.map((row) => row.team)).toEqual(["ICU", "Medicine"]);
    expect(rows[0]?.notices).toContain("From a hospital phone only");
  });

  it("does not add a team to a title that already has a prefix", () => {
    const { rows } = parseHandbookImportCsv("team,title\nMedicine,Ward: 4B\n", base);
    expect(rows[0]?.title).toBe("Ward: 4B");
  });

  it("never refuses a row on its own judgement: it notes, and the editor decides", () => {
    const { rows } = parseHandbookImportCsv("title,phone,type\nSwitchboard,ask at desk,mobile\n", base);
    expect(rows[0]).toMatchObject({ blocked: null, phoneType: "mobile" });
    expect(rows[0]?.notices).toEqual(
      expect.arrayContaining(["Will show as text, not a call button", "Updates an existing entry"]),
    );
  });

  it("matches an existing entry by title, so the editor sees old beside new", () => {
    const { rows } = parseHandbookImportCsv("title,phone\n switchboard ,9000 0001\n", base);
    expect(rows[0]?.existing).toEqual(SWITCHBOARD);
    expect(rows[0]?.phone).toBe("9000 0001");
  });

  it("blocks only what the server would refuse, and says why", () => {
    const { rows } = parseHandbookImportCsv(`title,phone\n${"x".repeat(161)},4456\n`, base);
    expect(rows[0]?.blocked).toMatch(/160/);
  });

  it("does not import person names", () => {
    const parsed = parseHandbookImportCsv("role,name,phone\nRegistrar,Dr Example,4456\n", base);
    expect(parsed.ignoredColumns).toContain("name");
    expect(JSON.stringify(parsed.rows)).not.toContain("Dr Example");
    expect(handbookImportIgnoredLine(parsed.ignoredColumns)).toContain("Person names are not imported yet");
  });

  it("ignores wait-time and after-hours columns: those are hospital-set fields that do not exist yet", () => {
    const parsed = parseHandbookImportCsv(
      "role,phone,wait (minutes),after hours\nRegistrar,4456,15,17:00-08:00\n",
      base,
    );
    expect(parsed.ignoredColumns).toEqual(["wait (minutes)", "after hours"]);
    expect(JSON.stringify(parsed.rows)).not.toMatch(/17:00|"15"/);
    expect(handbookImportIgnoredLine(parsed.ignoredColumns)).toBe("Not imported: wait (minutes), after hours.");
  });

  it("says when the file has no title column", () => {
    const parsed = parseHandbookImportCsv("phone\n4456\n", base);
    expect(parsed).toMatchObject({ missingTitleColumn: true, rows: [] });
  });

  it("skips blank lines and counts file lines, including quoted newlines", () => {
    const { rows } = parseHandbookImportCsv('title,notes\nA,"one\ntwo"\n\n,\nB,x\n', base);
    expect(rows.map((row) => [row.title, row.line])).toEqual([
      ["A", 2],
      ["B", 6],
    ]);
  });

  it("caps a file at 200 rows and says so", () => {
    const csv = "title\n" + Array.from({ length: 205 }, (_, index) => `Row ${index}`).join("\n");
    const parsed = parseHandbookImportCsv(csv, base);
    expect(parsed.rows).toHaveLength(200);
    expect(parsed.truncated).toBe(true);
  });
});

describe("importExistingFrom", () => {
  it("offers this site's entries in the chosen section, latest revision, never withdrawn ones", () => {
    const entries = [
      draft(ENTRY, { revision: 5 }),
      draft("40000000-0000-4000-8000-000000000002", { status: "withdrawn" }),
      draft("40000000-0000-4000-8000-000000000003", {
        content: { ...draft(ENTRY).content, siteId: OTHER_SITE },
      }),
      draft("40000000-0000-4000-8000-000000000004", {
        content: { ...draft(ENTRY).content, section: "referrals" },
      }),
    ];
    expect(importExistingFrom({ entries }, SITE, "contacts").map((item) => [item.id, item.revision])).toEqual([
      [ENTRY, 5],
    ]);
  });
});

describe("toEntrySave", () => {
  it("makes a new row an operational draft the existing action accepts", () => {
    const [row] = parseHandbookImportCsv(
      "title,phone,notes\nWard: Synthetic ward 4B,4401,Also known as: HDU\n",
      base,
    ).rows;
    const payload = toEntrySave(row!, { siteId: SITE, section: "contacts" });
    expect(payload).toEqual({
      action: "entry.save",
      siteId: SITE,
      section: "contacts",
      kind: "operational",
      title: "Ward: Synthetic ward 4B",
      body: "Also known as: HDU",
      phone: "4401",
      sources: [],
      orientationPhase: "first_shift",
      publish: false,
    });
    expect(serviceActionSchema.safeParse(payload).success).toBe(true);
  });

  it("updates an existing entry as a draft, keeping its kind, sources and body", () => {
    const [row] = parseHandbookImportCsv("title,phone\nSwitchboard,9000 0001\n", base).rows;
    expect(toEntrySave(row!, { siteId: SITE, section: "contacts" })).toMatchObject({
      entryId: ENTRY,
      expectedRevision: 3,
      phone: "9000 0001",
      body: "Synthetic example only",
      kind: "operational",
      publish: false,
    });
  });

  it("keeps a clinical entry's kind and sources on update, so a reviewed entry is never downgraded", () => {
    const clinical: HandbookImportExisting = {
      ...SWITCHBOARD,
      kind: "clinical",
      sources: [{ label: "Synthetic policy", url: "https://example.org/policy" }],
    };
    const [row] = parseHandbookImportCsv("title,phone\nSwitchboard,9000 0001\n", {
      section: "contacts",
      existing: [clinical],
    }).rows;
    const payload = toEntrySave(row!, { siteId: SITE, section: "contacts" });
    expect(payload).toMatchObject({ kind: "clinical", sources: clinical.sources, publish: false });
    expect(serviceActionSchema.safeParse(payload).success).toBe(true);
  });

  it("keeps the saved number when the row leaves the phone blank", () => {
    const [row] = parseHandbookImportCsv("title,notes\nSwitchboard,Level 1\n", base).rows;
    expect(toEntrySave(row!, { siteId: SITE, section: "contacts" })).toMatchObject({
      phone: "9000 0000",
      body: "Level 1",
    });
  });
});

describe("saveTickedRows", () => {
  const rows = parseHandbookImportCsv("title,phone\nA,4401\nB,4402\n", base).rows;

  it("spaces saves, waits out a 429, and reports each row", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const responses = [
      new Response("{}", { status: 429, headers: { "Retry-After": "5" } }),
      new Response("{}"),
      new Response("{}"),
    ];
    const fetchImpl = vi.fn<typeof fetch>(async () => responses.shift()!);
    const progress = vi.fn();
    const result = await saveTickedRows({
      serviceId: SERVICE,
      rows,
      siteId: SITE,
      section: "contacts",
      fetchImpl,
      sleep,
      onProgress: progress,
    });
    expect(result).toEqual({ saved: 2, failed: [], stopped: null });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`/api/on-call/services/${SERVICE}`);
    expect(sleep).toHaveBeenCalledWith(5000);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(progress).toHaveBeenLastCalledWith(2, 2);
  });

  it("gives up on a row after three retries and says so, without stopping the run", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 429, headers: { "Retry-After": "1" } }));
    const result = await saveTickedRows({
      serviceId: SERVICE,
      rows: rows.slice(0, 1),
      siteId: SITE,
      section: "contacts",
      fetchImpl,
      sleep: async () => {},
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(result).toEqual({
      saved: 0,
      failed: [{ line: 2, message: "Too many saves at once. Try again in a minute." }],
      stopped: null,
    });
  });

  it("waits 30 seconds when a 429 names no time", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const responses = [new Response("{}", { status: 429 }), new Response("{}")];
    await saveTickedRows({
      serviceId: SERVICE,
      rows: rows.slice(0, 1),
      siteId: SITE,
      section: "contacts",
      fetchImpl: vi.fn(async () => responses.shift()!),
      sleep,
    });
    expect(sleep).toHaveBeenCalledWith(30_000);
  });

  it("records the server's reason for a refused row and carries on", async () => {
    const responses = [
      new Response(JSON.stringify({ error: "The entry changed. Reload it." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
      new Response("{}"),
    ];
    const result = await saveTickedRows({
      serviceId: SERVICE,
      rows,
      siteId: SITE,
      section: "contacts",
      fetchImpl: vi.fn(async () => responses.shift()!),
      sleep: async () => {},
    });
    expect(result.saved).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.line).toBe(2);
    expect(result.failed[0]?.message).toBeTruthy();
  });

  it("stops when the session ends instead of failing every row", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 401 }));
    const result = await saveTickedRows({
      serviceId: SERVICE,
      rows,
      siteId: SITE,
      section: "contacts",
      fetchImpl,
      sleep: async () => {},
    });
    expect(result.stopped).toBe("session");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("stops when cancelled", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      return new Response("{}");
    });
    const result = await saveTickedRows({
      serviceId: SERVICE,
      rows,
      siteId: SITE,
      section: "contacts",
      fetchImpl,
      sleep: async () => {},
      signal: controller.signal,
    });
    expect(result).toEqual({ saved: 1, failed: [], stopped: "cancelled" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never sends a blocked row", async () => {
    const [blocked] = parseHandbookImportCsv(`title\n${"x".repeat(161)}\n`, base).rows;
    const fetchImpl = vi.fn(async () => new Response("{}"));
    const result = await saveTickedRows({
      serviceId: SERVICE,
      rows: [blocked!],
      siteId: SITE,
      section: "contacts",
      fetchImpl,
      sleep: async () => {},
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.failed).toEqual([{ line: 2, message: blocked!.blocked }]);
  });

  it("never sends publish: true", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("{}"));
    await saveTickedRows({
      serviceId: SERVICE,
      rows,
      siteId: SITE,
      section: "contacts",
      fetchImpl,
      sleep: async () => {},
    });
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body)).publish).toBe(false);
    }
  });
});

describe("publishing drafts", () => {
  it("offers only this site's operational drafts, oldest first", () => {
    const entries = [
      draft("40000000-0000-4000-8000-000000000002", { updatedAt: "2026-09-21T00:00:00.000Z" }),
      draft("40000000-0000-4000-8000-000000000003", { updatedAt: "2026-09-19T00:00:00.000Z" }),
      draft("40000000-0000-4000-8000-000000000004", {}, "clinical"),
      draft("40000000-0000-4000-8000-000000000005", { status: "published" }),
      draft("40000000-0000-4000-8000-000000000006", { content: { ...draft(ENTRY).content, siteId: OTHER_SITE } }),
    ];
    expect(publishableDrafts({ entries }, SITE).map((entry) => entry.id)).toEqual([
      "40000000-0000-4000-8000-000000000003",
      "40000000-0000-4000-8000-000000000002",
    ]);
  });

  it("publishes a draft at its loaded revision", () => {
    const entry = draft("40000000-0000-4000-8000-000000000002");
    const payload = toPublishSave(entry);
    expect(payload).toMatchObject({
      action: "entry.save",
      entryId: entry.id,
      expectedRevision: 2,
      publish: true,
      title: entry.content.title,
    });
    expect(serviceActionSchema.safeParse(payload).success).toBe(true);
  });

  it("refuses more than twenty at once", async () => {
    const many = Array.from({ length: HANDBOOK_PUBLISH_BATCH_MAX + 1 }, (_, index) =>
      draft(`40000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
    );
    await expect(
      publishDraftBatch({ serviceId: SERVICE, entries: many, fetchImpl: vi.fn(), sleep: async () => {} }),
    ).rejects.toThrow(RangeError);
  });

  it("publishes each draft 2 seconds apart and reports the count", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("{}"));
    const entries = [draft("40000000-0000-4000-8000-000000000002"), draft("40000000-0000-4000-8000-000000000003")];
    const result = await publishDraftBatch({ serviceId: SERVICE, entries, fetchImpl, sleep });
    expect(result).toEqual({ published: 2, failed: [], stopped: null });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(fetchImpl.mock.calls.every(([, init]) => JSON.parse(String(init?.body)).publish === true)).toBe(true);
  });

  it("never publishes a clinical entry from here", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}"));
    const clinical = draft("40000000-0000-4000-8000-000000000004", {}, "clinical");
    const result = await publishDraftBatch({
      serviceId: SERVICE,
      entries: [clinical],
      fetchImpl,
      sleep: async () => {},
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.failed).toEqual([{ entryId: clinical.id, message: "Clinical and legal entries go through review." }]);
  });
});
