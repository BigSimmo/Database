import { describe, expect, it } from "vitest";
import { serviceActionSchema } from "@/lib/on-call/service-model";
import { publishedHandbookItems } from "@/lib/on-call/handbook-items";
import { demoServiceDetail } from "@/lib/on-call/service-demo";

const id = "11111111-1111-4111-8111-111111111111";
const base = {
  action: "entry.save",
  siteId: id,
  section: "playbook",
  kind: "clinical",
  title: "Synthetic ladder",
  body: "",
  phone: "",
  sources: [{ label: "Policy", url: "https://example.org/policy" }],
  publish: true,
};
const step = {
  order: 1,
  whoToCall: "Registrar",
  when: "When the first role cannot be reached",
  phone: "5550 0042",
  waitMinutes: 10,
};
describe("Stage C local contracts", () => {
  it("accepts reviewed ladders and rejects operational, duplicate-order and invalid-wait ladders", () => {
    expect(serviceActionSchema.safeParse({ ...base, steps: [step] }).success).toBe(true);
    for (const patch of [
      { kind: "operational" },
      { steps: [step, step] },
      { steps: [{ ...step, waitMinutes: 0 }] },
      { steps: [{ ...step, waitMinutes: 121 }] },
    ]) {
      expect(serviceActionSchema.safeParse({ ...base, steps: [step], ...patch }).success).toBe(false);
    }
  });
  it("accepts role-only overnight cover and rejects names and equal endpoints", () => {
    const cover = { grade: "registrar", team: "Medicine", window: { start: "20:00", end: "08:00" } };
    expect(serviceActionSchema.safeParse({ ...base, section: "cover", cover }).success).toBe(true);
    expect(
      serviceActionSchema.safeParse({ ...base, section: "cover", cover: { ...cover, name: "Someone" } }).success,
    ).toBe(false);
    expect(
      serviceActionSchema.safeParse({
        ...base,
        section: "cover",
        cover: { ...cover, window: { start: "08:00", end: "08:00" } },
      }).success,
    ).toBe(false);
  });
  it("requires a published revision for confirmation and an explicit pair for site times", () => {
    expect(serviceActionSchema.safeParse({ action: "entry.confirm", entryId: id, publishedRevision: 2 }).success).toBe(
      true,
    );
    expect(serviceActionSchema.safeParse({ action: "entry.confirm", entryId: id }).success).toBe(false);
    expect(
      serviceActionSchema.safeParse({
        action: "site.update",
        siteId: id,
        afterHoursStart: "17:30",
        afterHoursEnd: "08:00",
      }).success,
    ).toBe(true);
    expect(
      serviceActionSchema.safeParse({ action: "site.update", siteId: id, afterHoursStart: null, afterHoursEnd: null })
        .success,
    ).toBe(true);
    expect(
      serviceActionSchema.safeParse({
        action: "site.update",
        siteId: id,
        afterHoursStart: "17:30",
        afterHoursEnd: null,
      }).success,
    ).toBe(false);
  });
  it("dates the published revision even while a newer draft exists", () => {
    const entry = {
      ...demoServiceDetail.entries[0],
      revision: 7,
      publishedRevision: 2,
      publishedAt: "2026-09-01T00:00:00Z",
      lastConfirmedAt: "2026-09-20T00:00:00Z",
    };
    const [item] = publishedHandbookItems({ entries: [entry] });
    expect(item.updatedAt).toBe(entry.publishedAt);
    expect(item).toHaveProperty("lastConfirmedAt", entry.lastConfirmedAt);
    expect(publishedHandbookItems({ entries: [{ ...entry, status: "withdrawn" }] })).toEqual([]);
  });
});

import { currentCover, handbookLadders } from "@/lib/on-call/service-availability";
const night = new Date("2026-09-27T14:00:00Z");
const daytime = new Date("2026-09-27T04:00:00Z");
describe("hospital cover and ladder time rules", () => {
  it("handles overnight cover and a 15-minute changeover overlap without publishing a name", () => {
    const raw = demoServiceDetail.entries.find((entry) => entry.content.section === "cover")!;
    const content = {
      ...raw.content,
      title: "Emergency: Private name must not show",
      cover: { grade: "registrar" as const, team: "Medicine", window: { start: "20:00", end: "08:00" } },
    };
    const items = publishedHandbookItems({ entries: [{ ...raw, publishedContent: content }] });
    expect(currentCover(items, night)[0].title).toBe("Registrar");
    expect(currentCover(items, night)[0].parsed.prefix).toBeNull();
    expect(currentCover(items, daytime)).toEqual([]);
    expect(currentCover(items, new Date("2026-09-26T23:55:00Z"))).toHaveLength(1);
    expect(currentCover(items, new Date("2026-09-27T00:16:00Z"))).toEqual([]);
    expect(
      currentCover(
        items.map((item) => ({ ...item, kind: "operational" })),
        night,
      ),
    ).toEqual([]);
  });
  it("uses hospital hours only, keeps both roles at changeover, and never invents a wait", () => {
    const item = publishedHandbookItems(demoServiceDetail).find((item) => item.section === "playbook")!;
    const items = [
      {
        ...item,
        steps: [
          { ...step, hours: "in-hours" as const },
          { ...step, order: 2, hours: "after-hours" as const, waitMinutes: undefined },
        ],
      },
    ];
    const hours = { afterHoursFrom: "20:00", afterHoursUntil: "08:00" };
    expect(handbookLadders(items, null, night)[0].steps).toHaveLength(2);
    expect(handbookLadders(items, hours, night)[0].steps.map((step) => step.order)).toEqual([2]);
    expect(handbookLadders(items, hours, new Date("2026-09-27T11:55:00Z"))[0].steps).toHaveLength(2);
    expect(handbookLadders(items, hours, night)[0].steps[0].waitMinutes).toBeUndefined();
  });
});
