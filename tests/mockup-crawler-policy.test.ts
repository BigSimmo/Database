import { describe, expect, it } from "vitest";
import { tryToParsePath } from "next/dist/lib/try-to-parse-path";
import loadNextConfig from "../next.config";

async function configuredHeaders() {
  const config = await loadNextConfig();
  return (await config.headers?.()) ?? [];
}

describe("public mockup crawler policy", () => {
  it("noindexes the exact public mockup namespace without affecting unrelated assets", async () => {
    const rules = await configuredHeaders();
    const robotsRules = rules.filter((rule) =>
      rule.headers.some((header) => header.key.toLowerCase() === "x-robots-tag"),
    );
    const mockupRule = robotsRules.find((rule) => rule.source === "/mockups/:path*");

    expect(mockupRule?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    expect(robotsRules.map((rule) => rule.source)).toEqual(["/offline.html", "/mockups/:path*"]);

    const parsed = tryToParsePath(mockupRule!.source);
    expect(parsed.error).toBeUndefined();
    expect(parsed.regexStr).toBeTruthy();

    const matches = new RegExp(parsed.regexStr!);
    expect(matches.test("/mockups/privacy-page-redesign-2026-08/desktop.png")).toBe(true);
    expect(matches.test("/offline.html")).toBe(false);
    expect(matches.test("/therapy-compass-data/therapies.json")).toBe(false);
  });
});
