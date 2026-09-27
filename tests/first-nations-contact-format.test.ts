import { describe, expect, it } from "vitest";
import { formatDayMonthYear, shareText, telHref, vcardFor } from "@/lib/first-nations/contact-format";

describe("contact format", () => {
  it("builds tel links for landlines, short hospital numbers and 13 numbers, never extensions", () => {
    expect(telHref("(08) 9000 0012")).toBe("tel:0890000012");
    expect(telHref("9000 0012")).toBe("tel:90000012");
    expect(telHref("13 92 76")).toBe("tel:139276");
    expect(telHref("ext 0002")).toBeUndefined();
  });
  it("builds a minimal vCard with the team name and number only", () => {
    const card = vcardFor({ name: "Aboriginal liaison team", number: "(08) 9000 0012" });
    expect(card).toContain("FN:Aboriginal liaison team");
    expect(card).toContain("TEL;TYPE=WORK:0890000012");
    expect(card).not.toMatch(/EMAIL|ADR|NOTE/);
  });
  it("writes share text and dates the calm way", () => {
    expect(shareText("Aboriginal liaison team", "9000 0001")).toBe("Aboriginal liaison team: 9000 0001");
    expect(formatDayMonthYear("2026-09-26")).toBe("26 Sep 2026");
  });
});
