import { describe, expect, it } from "vitest";

import { formatAwstDateTimeLocal } from "@/components/caring-contacts/workspace/manual-intake-form";

describe("manual Caring Contacts intake", () => {
  it("initializes datetime-local values from the AWST wall clock", () => {
    expect(formatAwstDateTimeLocal(new Date("2026-09-12T02:34:00.000Z"))).toBe("2026-09-12T10:34");
  });
});
