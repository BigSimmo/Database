import { expect, it } from "vitest";

import robots from "../src/app/robots";

it("serves crawler rules", () => {
  expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" } });
  expect(robots()).not.toHaveProperty("sitemap");
});
