import { describe, expect, it } from "vitest";

import { matchesHelpQuery } from "@/lib/admin/help-search";

describe("everyday-word search, on the page only", () => {
  it("finds a pay guide from 'payslip', a food note from 'hungry', and a login row from 'password'", () => {
    expect(matchesHelpQuery("Pay queries and salary packaging", "payslip")).toBe(true);
    expect(matchesHelpQuery("Food after hours: vending only after 19:30", "hungry")).toBe(true);
    expect(matchesHelpQuery("Logins, paging and remote access", "password")).toBe(true);
  });

  it("needs every word typed, ignores case and spacing, and matches everything on an empty query", () => {
    expect(matchesHelpQuery("Annual leave form", "  LEAVE   form ")).toBe(true);
    expect(matchesHelpQuery("Annual leave form", "leave taxi")).toBe(false);
    expect(matchesHelpQuery("Anything", "")).toBe(true);
  });
});
