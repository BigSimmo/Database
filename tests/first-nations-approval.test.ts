import { describe, expect, it } from "vitest";
import { approvalState, blockApprovalState, sectionApprovalState } from "@/lib/first-nations/approval";
import { parseFirstNationsContent, type Section } from "@/lib/first-nations/content-schema";
import { approvalFor, contentInput } from "./fixtures/first-nations-content";

const section: Section = {
  id: "ward-respect",
  tab: "Respect",
  modules: [
    {
      id: "ward-respect-module",
      title: "Respect",
      icon: "users",
      layout: "list",
      blocks: [
        {
          kind: "tip",
          id: "t1",
          do: "Offer the Aboriginal liaison officer on admission",
          why: "Early support helps people stay for care.",
          sourceId: "s1",
          checkedAt: "2026-09-26",
        },
      ],
    },
  ],
};

describe("approval", () => {
  it("is awaiting with no approval record", () => {
    expect(sectionApprovalState(section, [])).toBe("awaiting");
  });
  it("is approved when the hash matches", () => {
    expect(sectionApprovalState(section, [approvalFor(section.id, section)])).toBe("approved");
  });
  it("survives key reordering (formatting-only edit)", () => {
    const reordered = JSON.parse(
      JSON.stringify({ modules: section.modules, tab: section.tab, id: section.id }),
    ) as Section;
    expect(sectionApprovalState(reordered, [approvalFor(section.id, section)])).toBe("approved");
  });
  it("is revoked when one word changes", () => {
    const edited = structuredClone(section);
    const tip = edited.modules[0].blocks[0];
    if (tip.kind === "tip") tip.why = "Early support helps people remain for care.";
    expect(sectionApprovalState(edited, [approvalFor(section.id, section)])).toBe("awaiting");
  });
  it("ignores a record made for another subject", () => {
    expect(approvalState("other-section", section, [approvalFor(section.id, section)])).toBe("awaiting");
  });
  it("gates the risk line on its own record", () => {
    const risk = parseFirstNationsContent(contentInput()).riskLines[0];
    expect(blockApprovalState(risk, [])).toBe("awaiting");
    expect(blockApprovalState(risk, [approvalFor(risk.id, risk)])).toBe("approved");
  });
});

describe("content schema", () => {
  it("accepts the fixture", () => {
    expect(() => parseFirstNationsContent(contentInput())).not.toThrow();
  });
  it("rejects anything but six situations", () => {
    const input = contentInput();
    input.situations = input.situations.slice(0, 5);
    expect(() => parseFirstNationsContent(input)).toThrow(/situations/);
  });
  it("rejects a situation with two phrases", () => {
    const input = contentInput();
    input.situations[0].phrases = input.situations[0].phrases.slice(0, 2);
    expect(() => parseFirstNationsContent(input)).toThrow(/phrases/);
  });
  it("rejects a plan of six steps", () => {
    const input = contentInput();
    input.situations[0].plan = [
      "bedside-tip",
      "talking-tip",
      "family-tip",
      "contacts-tip",
      "mistakes-tip",
      "on-the-ward-tip",
    ];
    expect(() => parseFirstNationsContent(input)).toThrow(/plan/);
  });
  it("rejects the risk line on any situation but Wants to leave", () => {
    const input = contentInput();
    input.situations[0].riskLineRef = "wants-to-leave-risk";
    expect(() => parseFirstNationsContent(input)).toThrow(/Wants to leave/);
  });
  it("rejects a plan step that names no tip, note or contact", () => {
    const input = contentInput();
    input.situations[2].plan = ["bedside-tip", "talking-tip", "wants-to-leave-risk"];
    expect(() => parseFirstNationsContent(input)).toThrow(/must name a tip, note or contact/);
  });
  it("rejects a tiles module without exactly four contacts", () => {
    const input = contentInput();
    const contacts = input.pages.find((p) => p.id === "contacts");
    if (!contacts) throw new Error("fixture has no contacts page");
    contacts.sections[0].modules[0] = {
      id: "contacts-tiles",
      title: "Most used",
      icon: "phone",
      layout: "tiles",
      blocks: ["a", "b", "c"].map((n) => ({
        kind: "contact" as const,
        id: `tile-${n}`,
        name: `Team ${n}`,
        number: "1800 000 012",
        layer: "statewide" as const,
        sourceId: "src-test",
        checkedAt: "2026-09-26",
      })),
    };
    expect(() => parseFirstNationsContent(input)).toThrow(/four contacts/);
  });
});
