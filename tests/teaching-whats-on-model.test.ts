import { describe, expect, it } from "vitest";

import {
  attendanceLabels,
  attendanceMethods,
  healthServiceCodes,
  teachingResourceTeamActionSchema,
  teachingResourcesQuerySchema,
  teachingWhatsOnActionSchema,
  whatsOnReadResultSchema,
} from "@/lib/teaching/model";
import { plainTeachingIssue } from "@/lib/teaching/request";

const id = "11111111-1111-4111-8111-111111111111";
const id2 = "22222222-2222-4222-8222-222222222222";

describe("What's on and Resources request schemas", () => {
  it("needs exactly one of a session or a series for a week add, either way round", () => {
    expect(teachingWhatsOnActionSchema.safeParse({ action: "week_add.set", occurrenceId: id }).success).toBe(true);
    expect(teachingWhatsOnActionSchema.safeParse({ action: "week_add.unset", seriesId: id }).success).toBe(true);
    expect(teachingWhatsOnActionSchema.safeParse({ action: "week_add.set" }).success).toBe(false);
    expect(
      teachingWhatsOnActionSchema.safeParse({ action: "week_add.set", occurrenceId: id, seriesId: id2 }).success,
    ).toBe(false);
  });

  it("takes a plain occurrence id to attend, and a resource id to save or unsave", () => {
    expect(teachingWhatsOnActionSchema.safeParse({ action: "whats_on.attend", occurrenceId: id }).success).toBe(true);
    expect(teachingWhatsOnActionSchema.safeParse({ action: "resource_save.set", resourceId: id }).success).toBe(true);
    expect(
      teachingWhatsOnActionSchema.safeParse({ action: "resource_save.set", resourceId: id, extra: 1 }).success,
    ).toBe(false);
  });

  it("needs exactly one of a week or a session for resources, and a collection or a built-in name", () => {
    const r = (payload: object) => teachingResourcesQuerySchema.safeParse(payload).success;
    expect(r({ action: "resources.read", weekStart: "2026-09-28" })).toBe(true);
    expect(r({ action: "resources.read", occurrenceId: id })).toBe(true);
    expect(r({ action: "resources.read" })).toBe(false);
    expect(r({ action: "resources.read", weekStart: "2026-09-28", occurrenceId: id })).toBe(false);
    expect(r({ action: "collection.read", collectionId: id })).toBe(true);
    expect(r({ action: "collection.read", builtIn: "recordings" })).toBe(true);
    expect(r({ action: "collection.read", builtIn: "other" })).toBe(false);
    expect(r({ action: "collection.read", collectionId: id, builtIn: "saved" })).toBe(false);
  });

  it("adds a resource as a link or a library document, never both or neither, and https only", () => {
    // Slides always name their session (master plan R27), so the base carries one.
    const base = {
      action: "resource.add" as const,
      title: "Exam prep slides",
      kind: "slides" as const,
      occurrenceId: id2,
      noPatientDetails: true as const,
    };
    const a = (payload: object) => teachingResourceTeamActionSchema.safeParse({ ...base, ...payload }).success;
    expect(a({ url: "https://example.org/f" })).toBe(true);
    expect(a({ libraryDocumentId: id, kind: "library" })).toBe(true);
    expect(a({})).toBe(false); // neither url nor library document
    expect(a({ url: "https://example.org/f", libraryDocumentId: id })).toBe(false); // both
    expect(a({ url: "http://example.org/f" })).toBe(false); // https only
    expect(a({ libraryDocumentId: id })).toBe(false); // kind must be 'library'
  });

  it("attaches slides to one session only, never to a series or to nothing (master plan R27)", () => {
    const base = {
      action: "resource.add" as const,
      title: "Demo registrar teaching slides",
      kind: "slides" as const,
      url: "https://example.org/slides",
      noPatientDetails: true as const,
    };
    const parse = (payload: object) => teachingResourceTeamActionSchema.safeParse({ ...base, ...payload });
    expect(parse({ occurrenceId: id }).success).toBe(true);
    const bare = parse({});
    expect(bare.success).toBe(false);
    expect(plainTeachingIssue(bare.error?.issues ?? [])).toBe("Slides belong to one session. Choose the session.");
    expect(parse({ seriesId: id }).success).toBe(false);
    expect(parse({ collectionId: id }).success).toBe(false);
    // Other kinds may still sit in a collection or a series on their own.
    expect(parse({ kind: "recording", seriesId: id }).success).toBe(true);
    expect(parse({ kind: "reading", collectionId: id }).success).toBe(true);
  });

  it("refuses a resource ticked without confirming no patient details", () => {
    const base = { action: "resource.add" as const, title: "x", kind: "link" as const, url: "https://example.org" };
    expect(teachingResourceTeamActionSchema.safeParse({ ...base, noPatientDetails: false }).success).toBe(false);
    expect(teachingResourceTeamActionSchema.safeParse(base).success).toBe(false);
  });

  it("needs a section's collection, and refuses a session and a series together", () => {
    const base = {
      action: "resource.add" as const,
      title: "x",
      kind: "link" as const,
      url: "https://example.org",
      noPatientDetails: true as const,
    };
    expect(teachingResourceTeamActionSchema.safeParse({ ...base, sectionId: id }).success).toBe(false);
    expect(teachingResourceTeamActionSchema.safeParse({ ...base, sectionId: id, collectionId: id2 }).success).toBe(
      true,
    );
    expect(teachingResourceTeamActionSchema.safeParse({ ...base, occurrenceId: id, seriesId: id2 }).success).toBe(
      false,
    );
  });

  it("saves and renames collections and sections within their limits", () => {
    const a = (payload: object) => teachingResourceTeamActionSchema.safeParse(payload).success;
    expect(a({ action: "collection.save", name: "Exam prep" })).toBe(true);
    expect(a({ action: "collection.section.save", collectionId: id, name: "Written" })).toBe(true);
    expect(a({ action: "collection.section.save", name: "Written" })).toBe(false); // needs its collection
  });

  it("opens a series to the team or the health service, never another value", () => {
    const a = (openTo: string) =>
      teachingResourceTeamActionSchema.safeParse({ action: "series.set_open_to", seriesId: id, openTo }).success;
    expect(a("health_service")).toBe(true);
    expect(a("everyone")).toBe(false);
  });

  it("keeps the five health-service codes lower case, exactly as part 1 defines them", () => {
    expect(healthServiceCodes).toEqual(["nmhs", "smhs", "emhs", "wachs", "cahs", "demo"]);
  });

  it("carries each What's on row's level, so the client can work out 'For my level' (master plan R4)", () => {
    const row = {
      occurrenceId: id,
      serviceId: id2,
      teamName: "Demo older adult service",
      title: "Demo ECT journal club",
      startsAt: "2026-09-30T05:00:00Z",
      endsAt: "2026-09-30T06:00:00Z",
      venue: null,
      hasJoinLink: true,
      joinUrl: "https://example.org/demo-join",
      status: "scheduled",
      isPresenter: false,
      source: "teaching",
      own: false,
      inMyWeek: false,
      audience: "registrars",
    };
    const parsed = whatsOnReadResultSchema.parse({ healthServices: ["demo"], sessions: [row] });
    expect(parsed.sessions[0].audience).toBe("registrars");
    expect(
      whatsOnReadResultSchema.safeParse({ healthServices: [], sessions: [{ ...row, audience: "everyone" }] }).success,
    ).toBe(false);
  });
});

// Master plan R17 moves S10's Cycle 3 here; R16 drops its separate visitor label.
describe("guarding the two easiest mistakes in What's on's own code", () => {
  it("never grows a fourth attendance method for a visitor, and labels members and visitors alike", () => {
    expect(attendanceMethods).toEqual(["code_room", "code_teams", "self"]);
    expect(attendanceLabels.self).toBe("Self-reported");
  });
});
