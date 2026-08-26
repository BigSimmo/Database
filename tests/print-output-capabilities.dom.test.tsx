import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CONFIDENTIAL_DOCUMENT_FOOTER,
  BrowserPrintButton,
  PrintOutput,
  PrintSection,
} from "@/components/ui/print-output";

/**
 * `print-output.tsx` is a shared repository primitive with two consumers outside
 * the Care Plan prototype — the Therapy Compass Brief and Patient Sheet screens.
 * Every capability added for Care Plan is additive and default-off, and each one
 * is proved here rather than only through the route that consumes it.
 *
 * Two kinds of assertion appear below, because neither is sufficient alone:
 *
 *  1. **DOM assertions** prove the component emits the attribute or node.
 *  2. **Static stylesheet assertions** prove the attribute actually changes what
 *     prints. Vitest runs with `css: false` and no print medium, so a rendered
 *     attribute proves nothing about paper on its own — a capability whose rule
 *     was deleted from `globals.css` would leave every DOM assertion green.
 */

const globalsSource = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

/** The shared `@media print` block that owns every `[data-print-*]` rule. */
function sharedPrintBlock(): string {
  const start = globalsSource.indexOf("@page shared-clinical-output");
  expect(start, "globals.css no longer declares the shared clinical print page").toBeGreaterThanOrEqual(0);
  const end = globalsSource.indexOf("\n[data-print-provenance] {", start);
  expect(end, "the shared print block no longer ends at the screen-side provenance rule").toBeGreaterThan(start);
  return globalsSource.slice(start, end);
}

/** The declarations of the first rule in `block` whose selector contains `selector`. */
function declarationsFor(block: string, selector: string): string {
  const index = block.indexOf(selector);
  expect(index, `no print rule mentions ${selector}`).toBeGreaterThanOrEqual(0);
  const open = block.indexOf("{", index);
  const close = block.indexOf("}", open);
  expect(open, `${selector} has no rule body`).toBeGreaterThan(index);
  expect(close, `${selector} has an unterminated rule body`).toBeGreaterThan(open);
  return block.slice(open + 1, close);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PrintOutput default rendering", () => {
  /**
   * The binding constraint on this task: no existing consumer's rendering may
   * change. Pinning the whole default markup fails on any node, attribute, or
   * wrapper added by a later capability that forgets to be default-off — which a
   * per-capability "is the attribute absent?" test would not catch.
   */
  it("emits exactly the markup its existing consumers already render", () => {
    const { container } = render(<PrintOutput provenance="Source: a record">Body</PrintOutput>);
    expect(container.innerHTML).toBe(
      '<div data-print-output="true" class="">Body<footer data-print-provenance="true">Source: a record</footer></div>',
    );
  });

  it("still applies the therapy paper tone and a caller class exactly as before", () => {
    const { container } = render(
      <PrintOutput paperTone="therapy" className="paper" provenance="Source: a record">
        Body
      </PrintOutput>,
    );
    const output = container.querySelector("[data-print-output]");
    expect(output).toHaveAttribute("data-therapy-paper", "");
    expect(output).toHaveClass("paper");
  });
});

describe("PrintOutput per-section page-break control", () => {
  it("is opt-in and avoids splitting a section across pages", () => {
    render(
      <PrintSection testId="section">
        <p>Kept together</p>
      </PrintSection>,
    );
    expect(screen.getByTestId("section")).toHaveAttribute("data-print-break-inside", "avoid");
    expect(screen.getByTestId("section")).not.toHaveAttribute("data-print-break-before");
  });

  it("can start a section on a fresh page when the caller asks", () => {
    render(
      <PrintSection breakBefore="page" testId="section">
        <p>New page</p>
      </PrintSection>,
    );
    expect(screen.getByTestId("section")).toHaveAttribute("data-print-break-before", "page");
  });

  it("can be told not to control breaks at all", () => {
    render(
      <PrintSection breakInside="auto" testId="section">
        <p>May split</p>
      </PrintSection>,
    );
    expect(screen.getByTestId("section")).not.toHaveAttribute("data-print-break-inside");
  });

  // …and the attributes are not decoration: the stylesheet acts on them.
  it("is backed by real break declarations in the shared print block", () => {
    const block = sharedPrintBlock();
    expect(declarationsFor(block, '[data-print-break-inside="avoid"]')).toMatch(/break-inside:\s*avoid/);
    expect(declarationsFor(block, '[data-print-break-before="page"]')).toMatch(/break-before:\s*page/);
  });
});

describe("PrintOutput monochrome state treatment", () => {
  it("is off by default and marks the output when asked for", () => {
    const { container: plain } = render(<PrintOutput provenance="p">Body</PrintOutput>);
    expect(plain.querySelector("[data-print-monochrome]")).toBeNull();

    const { container: mono } = render(
      <PrintOutput monochrome provenance="p">
        Body
      </PrintOutput>,
    );
    expect(mono.querySelector("[data-print-output]")).toHaveAttribute("data-print-monochrome", "");
  });

  it("is backed by a print rule that removes tint from the whole subtree", () => {
    const declarations = declarationsFor(sharedPrintBlock(), "[data-print-monochrome] *");
    // A greyscale printer drops the tint that carried a state. Forcing white
    // paper and black ink and borders leaves the border and the words carrying
    // it instead, which is the repository rule that colour never carries state
    // on its own.
    expect(declarations).toMatch(/background-color:\s*#ffffff/i);
    expect(declarations).toMatch(/color:\s*#000000/i);
    expect(declarations).toMatch(/border-color:\s*#000000/i);
  });
});

describe("PrintOutput confidential-document footer", () => {
  it("is off by default and carries the standard wording when asked for", () => {
    const { container: plain } = render(<PrintOutput provenance="p">Body</PrintOutput>);
    expect(plain.querySelector("[data-print-confidential]")).toBeNull();

    const { container: confidential } = render(
      <PrintOutput confidential provenance="p">
        Body
      </PrintOutput>,
    );
    /*
     * Spelled out, not read from the constant the component renders from. This
     * assertion used to compare the rendered footer against
     * `CONFIDENTIAL_DOCUMENT_FOOTER`, which passes for any wording at all —
     * including a defective one — and is the generative shape this repository
     * has already shipped twice and banned.
     */
    expect(confidential.querySelector("[data-print-confidential]")).toHaveTextContent(
      "Confidential clinical document. Handle according to local policy.",
    );
    expect(CONFIDENTIAL_DOCUMENT_FOOTER).toBe("Confidential clinical document. Handle according to local policy.");
    expect(CONFIDENTIAL_DOCUMENT_FOOTER).toMatch(/^Confidential clinical document\./);

    /*
     * Two of the three sheets carrying this footer are handed to a patient. It
     * must not tell them to dispose of a document the same page has just told
     * them to keep somewhere they can find it quickly, and must not point them
     * at a health-service policy they do not hold and cannot consult.
     */
    expect(CONFIDENTIAL_DOCUMENT_FOOTER).not.toMatch(/dispose/i);
    expect(CONFIDENTIAL_DOCUMENT_FOOTER).not.toMatch(/keep it/i);
    expect(CONFIDENTIAL_DOCUMENT_FOOTER).not.toMatch(/local health service policy/i);
  });

  it("is print furniture: hidden on screen, shown on paper", () => {
    expect(declarationsFor(sharedPrintBlock(), "[data-print-confidential]")).toMatch(/display:\s*block/);
    // The screen-side rule sits outside the print block.
    const screenRule = globalsSource.slice(globalsSource.indexOf("\n[data-print-provenance] {"));
    expect(screenRule).toMatch(/\[data-print-confidential\][\s\S]{0,120}display:\s*none/);
  });
});

describe("PrintOutput printed-at stamp", () => {
  it("is off by default and renders exactly what the caller supplies", () => {
    const { container: plain } = render(<PrintOutput provenance="p">Body</PrintOutput>);
    expect(plain.querySelector("[data-print-stamp]")).toBeNull();

    const { container: stamped } = render(
      <PrintOutput printedAt="Printed on 20/08/2026 at 2:30 pm AWST." provenance="p">
        Body
      </PrintOutput>,
    );
    expect(stamped.querySelector("[data-print-stamp]")).toHaveTextContent("Printed on 20/08/2026 at 2:30 pm AWST.");
  });

  /**
   * The primitive must never read a clock of its own. A stamp generated inside
   * the component would make every consumer's output non-reproducible, and the
   * Care Plan prototype forbids a wall-clock read outright.
   */
  it("reads no clock of its own", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/ui/print-output.tsx"), "utf8");
    expect(source).not.toMatch(/new Date|Date\.now|toLocale(?:Date|Time)String|Intl\.DateTimeFormat/);
  });

  it("is print furniture: hidden on screen, shown on paper", () => {
    expect(declarationsFor(sharedPrintBlock(), "[data-print-stamp]")).toMatch(/display:\s*block/);
    const screenRule = globalsSource.slice(globalsSource.indexOf("\n[data-print-provenance] {"));
    expect(screenRule).toMatch(/\[data-print-stamp\][\s\S]{0,120}display:\s*none/);
  });
});

describe("BrowserPrintButton pre-print hook", () => {
  it("still asks the browser to print and nothing else when no hook is given", async () => {
    const user = userEvent.setup();
    const printSpy = vi.fn();
    vi.stubGlobal("print", printSpy);

    render(<BrowserPrintButton label="Print brief" />);
    await user.click(screen.getByRole("button", { name: "Print brief" }));

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  // Order matters and is the whole point of the hook: a caller recording that a
  // print view was opened must record it before the browser blocks on its own
  // print dialogue.
  it("runs the caller's hook before the browser is asked to print", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    vi.stubGlobal("print", () => order.push("print"));

    render(<BrowserPrintButton label="Print this plan" onBeforePrint={() => order.push("before")} />);
    await user.click(screen.getByRole("button", { name: "Print this plan" }));

    expect(order).toEqual(["before", "print"]);
  });
});
