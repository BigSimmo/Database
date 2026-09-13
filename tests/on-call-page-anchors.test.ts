import { describe, expect, it } from "vitest";

import {
  allocateOnCallGroupSlug,
  onCallGroupAnchorId,
  onCallGroupSlug,
} from "@/components/on-call/on-call-page-anchors";

describe("onCallGroupSlug", () => {
  it("collapses punctuation the way colliding labels do", () => {
    // The review case: two owner-typed groups that are different words but
    // one slug. The allocator below is what keeps their anchors apart.
    expect(onCallGroupSlug("ED / General")).toBe("ed-general");
    expect(onCallGroupSlug("ED General")).toBe("ed-general");
  });

  it("falls back to a usable fragment when a label is all punctuation", () => {
    expect(onCallGroupSlug("///")).toBe("group");
  });
});

describe("allocateOnCallGroupSlug", () => {
  it("disambiguates labels that normalize to the same slug", () => {
    const taken = new Set<string>();
    expect(allocateOnCallGroupSlug("ED / General", taken)).toBe("ed-general");
    expect(allocateOnCallGroupSlug("ED General", taken)).toBe("ed-general-2");
    expect(taken.has("ed-general")).toBe(true);
    expect(taken.has("ed-general-2")).toBe(true);
  });

  it("keeps a later third collision going, rather than reusing -2", () => {
    const taken = new Set<string>();
    allocateOnCallGroupSlug("ED / General", taken);
    allocateOnCallGroupSlug("ED General", taken);
    expect(allocateOnCallGroupSlug("ED--General", taken)).toBe("ed-general-3");
  });

  it("still produces the id the header and the heading share", () => {
    const taken = new Set<string>();
    const slug = allocateOnCallGroupSlug("Ward 4B", taken);
    expect(onCallGroupAnchorId(slug)).toBe("on-call-group-ward-4b");
  });
});
