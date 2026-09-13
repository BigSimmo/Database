import { describe, expect, it } from "vitest";

import {
  SPECIFIERS_IS_AUTOMATED_DECISION_SUPPORT,
  SPECIFIERS_REQUIRE_OPTION_REVIEW_BADGE,
  SPECIFIERS_SAFETY_NOTE,
  SPECIFIERS_USAGE_MODE,
} from "@/lib/specifiers-governance";
import {
  SPECIFIERS_IS_AUTOMATED_DECISION_SUPPORT as contentCds,
  SPECIFIERS_REQUIRE_OPTION_REVIEW_BADGE as contentBadge,
  SPECIFIERS_SAFETY_NOTE as contentNote,
  SPECIFIERS_USAGE_MODE as contentMode,
} from "@/lib/specifiers-content";

describe("specifiers governance binding (#Z3GZ5P)", () => {
  it("binds Specifiers as aide-memoire reference only, not automated CDS", () => {
    expect(SPECIFIERS_USAGE_MODE).toBe("aide-memoire-reference-only");
    expect(SPECIFIERS_IS_AUTOMATED_DECISION_SUPPORT).toBe(false);
    expect(SPECIFIERS_REQUIRE_OPTION_REVIEW_BADGE).toBe(true);
    expect(SPECIFIERS_SAFETY_NOTE).toMatch(/aide-memoire reference only/i);
    expect(SPECIFIERS_SAFETY_NOTE).toMatch(/not automated clinical decision support/i);
  });

  it("re-exports the same binding from the server catalogue module", () => {
    expect(contentMode).toBe(SPECIFIERS_USAGE_MODE);
    expect(contentCds).toBe(SPECIFIERS_IS_AUTOMATED_DECISION_SUPPORT);
    expect(contentBadge).toBe(SPECIFIERS_REQUIRE_OPTION_REVIEW_BADGE);
    expect(contentNote).toBe(SPECIFIERS_SAFETY_NOTE);
  });
});
