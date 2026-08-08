import { describe, expect, it } from "vitest";

import { MAX_LIVE_LIGHTHOUSE_INVOCATIONS, parseLiveWebVitalsInputs } from "../scripts/live-web-vitals-inputs.mjs";

const origin = "https://psychiatry.tools";

describe("parseLiveWebVitalsInputs", () => {
  it("normalizes a bounded, same-origin dispatch matrix", () => {
    expect(
      parseLiveWebVitalsInputs({
        origin: `${origin}/`,
        routes: " /, /therapy-compass, /documents/search ",
        samples: "3",
      }),
    ).toEqual({ origin, routes: ["/", "/therapy-compass", "/documents/search"], samples: 3, invocations: 18 });
  });

  it.each([
    ["an absolute URL", "https://other.example/forms", "canonical root-relative"],
    ["a protocol-relative URL", "//other.example/forms", "canonical root-relative"],
    ["an at-sign path", "/@other", "canonical root-relative"],
    ["a query string", "/forms?preview=1", "canonical root-relative"],
    ["a trailing-slash redirect", "/forms/", "canonical root-relative"],
    ["a duplicate route", "/forms,/forms", "duplicate path"],
    ["a colliding artifact slug", "/a/b,/a-b", "filename slugs"],
  ])("rejects %s", (_name, routes, message) => {
    expect(() => parseLiveWebVitalsInputs({ origin, routes, samples: "3" })).toThrow(message);
  });

  it("requires enough samples without allowing an unbounded suite", () => {
    expect(() => parseLiveWebVitalsInputs({ origin, routes: "/forms", samples: "2" })).toThrow("at least 3");
    expect(() =>
      parseLiveWebVitalsInputs({ origin, routes: "/,/therapy-compass,/documents/search,/dsm,/forms", samples: "4" }),
    ).toThrow(`maximum is ${MAX_LIVE_LIGHTHOUSE_INVOCATIONS}`);
  });
});
