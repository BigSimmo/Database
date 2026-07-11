import { describe, expect, it } from "vitest";

import { formatDateish } from "@/components/master-document-flow-mockups";

describe("formatDateish", () => {
  it("renders date-only ISO values in UTC without shifting a day", () => {
    // Regression: `new Date("2026-07-10")` is UTC midnight, so local-time formatting
    // rolls back to 09 Jul in negative-offset zones. UTC formatting keeps the 10th.
    expect(formatDateish("2026-07-10")).toBe("10 Jul 2026");
  });

  it("formats full ISO timestamps in UTC", () => {
    // 23:30Z is still the 12th in UTC even though it is the 13th locally in +offset zones.
    expect(formatDateish("2024-04-12T23:30:00Z")).toBe("12 Apr 2024");
  });

  it("passes bare years and free text through unchanged", () => {
    expect(formatDateish("2026")).toBe("2026");
    expect(formatDateish("Review 2026")).toBe("Review 2026");
  });

  it("returns null for empty or missing input", () => {
    expect(formatDateish(null)).toBeNull();
    expect(formatDateish(undefined)).toBeNull();
    expect(formatDateish("   ")).toBeNull();
  });
});
