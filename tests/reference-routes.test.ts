import { describe, expect, it } from "vitest";

import {
  COLOUR_CODING_REFERENCE_ROUTE,
  SHARED_APP_HOME_ROUTE,
  colourCodingReferenceHref,
} from "@/lib/reference-routes";

describe("reference routes", () => {
  it("builds the colour-coding reference href from the shared route constant", () => {
    expect(colourCodingReferenceHref()).toBe(COLOUR_CODING_REFERENCE_ROUTE);
    expect(COLOUR_CODING_REFERENCE_ROUTE).toBe("/reference/colour-coding");
  });

  it("exposes the shared app home fallback for standalone reference pages", () => {
    expect(SHARED_APP_HOME_ROUTE).toBe("/");
  });
});
