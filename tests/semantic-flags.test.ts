import { describe, expect, it } from "vitest";

import { clinicalBadgeTonePriority } from "@/components/clinical-dashboard/clinical-badge";
import {
  CONTENT_DOMAIN_META,
  CONTENT_DOMAIN_ORDER,
  SEMANTIC_FLAG_CATALOGUE,
  flagsForDomain,
} from "@/lib/semantic-flags";
import { SEMANTIC_ICON_KEYS, SEMANTIC_TONE_META, SEMANTIC_TONE_PRIORITY, SEMANTIC_TONES } from "@/lib/semantic-tone";

describe("semantic tone system", () => {
  it("uses exactly one priority map across lib and render layers", () => {
    // Guards the de-duplication: the render layer must re-export the lib map,
    // not keep its own copy that can drift.
    expect(clinicalBadgeTonePriority).toBe(SEMANTIC_TONE_PRIORITY);
  });

  it("lists every tone in the priority map and orders them by descending urgency", () => {
    expect([...SEMANTIC_TONES].sort()).toEqual(Object.keys(SEMANTIC_TONE_PRIORITY).sort());
    const priorities = SEMANTIC_TONES.map((tone) => SEMANTIC_TONE_PRIORITY[tone]);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  });

  it("gives the two safety tones a default icon and keeps the rest quiet", () => {
    expect(SEMANTIC_TONE_META.danger.defaultIcon).toBe(true);
    expect(SEMANTIC_TONE_META.warning.defaultIcon).toBe(true);
    for (const tone of ["clinical", "success", "neutral", "info"] as const) {
      expect(SEMANTIC_TONE_META[tone].defaultIcon).toBe(false);
    }
  });
});

describe("semantic flag catalogue", () => {
  it("only uses the six approved tones", () => {
    for (const flag of SEMANTIC_FLAG_CATALOGUE) {
      expect(SEMANTIC_TONES).toContain(flag.tone);
    }
  });

  it("has no duplicate flag ids", () => {
    const ids = SEMANTIC_FLAG_CATALOGUE.map((flag) => flag.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every content domain", () => {
    for (const domain of CONTENT_DOMAIN_ORDER) {
      expect(flagsForDomain(domain).length).toBeGreaterThan(0);
      expect(CONTENT_DOMAIN_META[domain]).toBeTruthy();
    }
    // Every catalogued flag belongs to a declared domain.
    for (const flag of SEMANTIC_FLAG_CATALOGUE) {
      expect(CONTENT_DOMAIN_ORDER).toContain(flag.domain);
    }
  });

  it("ensures every danger/warning flag renders a non-colour cue", () => {
    for (const flag of SEMANTIC_FLAG_CATALOGUE) {
      if (flag.tone === "danger" || flag.tone === "warning") {
        const hasCue = Boolean(flag.iconKey) || SEMANTIC_TONE_META[flag.tone].defaultIcon;
        expect(hasCue).toBe(true);
      }
    }
  });

  it("uses only known icon keys", () => {
    for (const flag of SEMANTIC_FLAG_CATALOGUE) {
      if (flag.iconKey) expect(SEMANTIC_ICON_KEYS).toContain(flag.iconKey);
    }
    // The controlled-drug flag must carry the lock icon key.
    const controlled = SEMANTIC_FLAG_CATALOGUE.find((flag) => flag.id === "med-controlled");
    expect(controlled?.iconKey).toBe("controlled");
    expect(controlled?.tone).toBe("warning");
  });
});
