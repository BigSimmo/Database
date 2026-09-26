import { describe, expect, it } from "vitest";
import { parseFirstNationsContent } from "@/lib/first-nations/content-schema";
import { buildBedsideModel, buildInnerPageModel, buildSearchIndex } from "@/lib/first-nations/view-model";
import {
  approvalFor,
  contentInput,
  contentWithNoteWording,
  enabledProfile,
  testInputs,
} from "./fixtures/first-nations-content";

const wantsToLeave = (inputs = testInputs()) =>
  buildBedsideModel(inputs).situations.find((s) => s.id === "wants-to-leave");

describe("First Nations view-model contract", () => {
  it("keeps the immediate-risk line hidden until its approval record exists", () => {
    expect(wantsToLeave()?.riskLine).toBeNull();
    expect(JSON.stringify(buildBedsideModel(testInputs()))).not.toMatch(/Immediate risk\?/);
  });
  it("shows the risk line once the owner's OK is recorded", () => {
    const inputs = testInputs();
    const risk = inputs.content.riskLines[0];
    expect(wantsToLeave(testInputs({ approvals: [approvalFor(risk.id, risk)] }))?.riskLine).toBe(risk.text);
  });
  it("hides the risk line again when its words change after approval", () => {
    const original = testInputs().content.riskLines[0];
    const input = contentInput();
    input.riskLines[0].text = "Immediate risk? Call security.";
    const inputs = testInputs({
      content: parseFirstNationsContent(input),
      approvals: [approvalFor(original.id, original)],
    });
    expect(wantsToLeave(inputs)?.riskLine).toBeNull();
  });
  it("keeps Bedside's example line while the lifted mistakes still await approval", () => {
    const input = contentInput();
    const mistakes = input.pages.find((p) => p.id === "mistakes")!;
    mistakes.sections[0].modules[0].blocks = [
      {
        kind: "avoid",
        id: "mistakes-avoid",
        avoid: "Avoid this",
        instead: "Do this",
        sourceId: "src-test",
        checkedAt: "2026-09-26",
      },
    ];
    const content = parseFirstNationsContent(input);
    const approveAll = (skip: string | null) => [
      ...content.pages.flatMap((p) => p.sections.filter((s) => s.id !== skip).map((s) => approvalFor(s.id, s))),
      ...content.situations.map((s) => approvalFor(`situation:${s.id}`, s)),
    ];
    const line = (skip: string | null) =>
      buildBedsideModel(testInputs({ content, approvals: approveAll(skip) })).showExampleLine;
    expect(line("mistakes-main")).toBe(true);
    expect(line(null)).toBe(false);
  });
  it("resolves plan steps from the blocks they reference", () => {
    const s = buildBedsideModel(testInputs()).situations[0];
    expect(s.plan.map((p) => p.title)).toEqual(["Tip on bedside", "Tip on talking", "Call Aboriginal Interpreting WA"]);
    expect(s.phrases).toHaveLength(3);
    expect(s.awaiting).toBe(true);
  });
  it("never renders or indexes our own note wording before approval", () => {
    const inputs = testInputs({ content: parseFirstNationsContent(contentWithNoteWording()) });
    expect(JSON.stringify(buildInnerPageModel(inputs, "contacts"))).not.toMatch(/Collaborated with/);
    expect(buildSearchIndex(inputs).some((e) => e.id === "w1")).toBe(false);
  });
  it("shows the hospital hero and Acknowledgement only with the layer on and approved words", () => {
    const profile = enabledProfile();
    expect(buildBedsideModel(testInputs({ profile })).hospitals[0]?.liaison.number).toBe("9000 0001");
    expect(buildBedsideModel(testInputs({ profile })).acknowledgement).toBeNull();
    const ack = approvalFor(`acknowledgement:${profile.id}`, profile.acknowledgement);
    expect(buildBedsideModel(testInputs({ profile, approvals: [ack] })).acknowledgement).toBe(profile.acknowledgement);
    expect(buildBedsideModel(testInputs({ profile: { ...profile, enabled: false } })).hospitals).toEqual([]);
  });
});
