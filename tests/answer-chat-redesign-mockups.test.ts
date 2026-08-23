import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sourceSegment } from "./helpers/source-contract";

const source = readFileSync(new URL("../src/components/answer-chat-redesign-mockups.tsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../src/app/mockups/answer-chat-redesign/page.tsx", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../src/app/mockups/mockups-layout-client.tsx", import.meta.url), "utf8");

describe("answer chat redesign mockups", () => {
  it("renders frames at the widths named by their captions", () => {
    expect(source).toContain('device === "phone" ? "w-[390px]" : "w-[1280px]"');
    expect(source).toContain('device === "phone" ? "Phone 390" : "Desktop 1280"');
    expect(source).not.toContain('device === "phone" ? "w-[340px]"');
  });

  it("shows every direction at both widths", () => {
    const showcase = sourceSegment(source, "function DirectionShowcase", "export function AnswerChatRedesignMockups", {
      label: "direction showcase frames",
    });
    expect(showcase).toContain('<DirectionFrame direction={direction.id} device="phone" />');
    expect(showcase).toContain('<DirectionFrame direction={direction.id} device="desktop" />');
  });

  it("keeps nested source titles at h3 under direction h2s", () => {
    expect(source).toContain("<h1 className=");
    expect(source).toContain("id={`${direction.id}-title`}");
    const quote = sourceSegment(source, "function QuoteCard", "function SourceChip", { label: "quote card heading" });
    expect(quote).toContain("<h3 className=");
    expect(quote).not.toContain("<h2");
    const sheet = sourceSegment(source, "function InFrameSheet", "function SimpleAnswer", {
      label: "in-frame sheet heading",
    });
    expect(sheet).toContain("<h3 className=");
    expect(sheet).not.toContain("<h2");
  });

  it("pins the privacy obligation and privacy link verbatim", () => {
    expect(source).toContain('const PRIVACY_LINE = "Do not enter patient-identifiable information.";');
    expect(source).toContain('const PRIVACY_LINK = "Privacy and data processing";');
    expect(source).toContain('href="/privacy"');
  });

  it("draws one composer per frame and suppresses shared mockup chrome", () => {
    expect(source.match(/data-composer="1"/g)).toEqual(['data-composer="1"']);
    expect(source).toContain("composerCount");
    expect(layoutSource).toContain('pathname === "/mockups/answer-chat-redesign"');
    expect(layoutSource).toContain("!isAnswerChatRedesignMockup");
    expect(pageSource).toContain("AnswerChatRedesignMockups");
  });
});
