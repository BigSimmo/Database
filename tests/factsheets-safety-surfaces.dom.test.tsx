import { cleanup, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FactsheetDetailPage } from "@/components/factsheets/factsheet-detail-page";
import {
  FACTSHEET_CRISIS_CONTACTS,
  FACTSHEET_EMERGENCY_NUMBER,
  factsheets,
  findFactsheet,
  type Factsheet,
} from "@/components/factsheets/factsheets-data";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/factsheets/sertraline",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));

/**
 * Screen coverage for the safety surfaces added alongside the clinical-content
 * work.
 *
 * `tests/factsheets-clinical-safeguards.test.ts` walks `printBlocks`, which is
 * the printed take-away only. Both projections have to carry these surfaces,
 * and a reader on the page is the more common case — so the assertions that the
 * emergency route and the act-now list actually render live here, against the
 * real component, rather than being inferred from the print projection.
 */
/**
 * Text from the on-screen projection only.
 *
 * The page renders the printed take-away into the same DOM
 * (`.factsheet-print-sheet`), so an assertion over `document.body` passes even
 * when the screen block has been deleted — which is precisely the gap these
 * tests exist to close. Excluding that subtree is what makes them real.
 */
function screenText(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  for (const printed of clone.querySelectorAll(".factsheet-print-sheet")) printed.remove();
  return clone.textContent ?? "";
}

function renderSheet(slug: string): Factsheet {
  const factsheet = findFactsheet(slug);
  if (!factsheet) throw new Error(`missing factsheet ${slug}`);
  cleanup();
  render(<FactsheetDetailPage factsheet={factsheet} />);
  return factsheet;
}

describe("the emergency route renders on screen, not just in print", () => {
  for (const slug of ["ssri", "escitalopram"]) {
    it(`renders the urgent-help block on the ${slug} sheet`, () => {
      renderSheet(slug);
      // These sheets name self-harm and serotonin toxicity. The block that
      // tells a reader what to do about that must be on the page.
      // Appears in both the screen body and the print sheet the page also
      // renders; both are reader-facing, so either match is a pass.
      const body = screenText();
      expect(body, `${slug} must render the urgent-help block on screen`).toMatch(/When to get urgent help/i);
      expect(body).toMatch(/\b000\b/);
      expect(body).toMatch(/emergency department/i);
    });
  }

  it("renders the lithium act-now list with its own anchor", () => {
    renderSheet("lithium-monitoring");
    expect(screenText()).toMatch(/Signs of lithium toxicity/i);
    // The anchor the section index points at must exist in the DOM, or the
    // jump target is declared but unreachable.
    expect(document.querySelector("#factsheet-warning-signs")).not.toBeNull();
    expect(document.querySelector("#factsheet-staying-safe")).not.toBeNull();

    const body = screenText();
    expect(body).toMatch(/13\s*11\s*26/); // Poisons Information Centre
    expect(body).toMatch(/straight away|call 000/i);
    // "Same day" alone is too slow for confusion, unsteadiness or slurred
    // speech, so the list must name an immediate route and must not send a
    // symptomatic reader away with a next-appointment answer. Asserted on the
    // act-now list itself rather than the whole page, so unrelated prose
    // elsewhere on the sheet cannot satisfy it.
    const actNow = document.querySelector("#factsheet-warning-signs")?.textContent ?? "";
    expect(actNow).toMatch(/emergency department/i);
    expect(actNow).toMatch(/\b000\b/);
    expect(actNow).toMatch(/13\s*11\s*26/);
    expect(actNow).toMatch(/do not take the next dose/i);
    expect(actNow).not.toMatch(/next appointment/i);
  });

  it("does not leave a sheet naming an emergency symptom without a route on screen", () => {
    const EMERGENCY = /self-harm|suicid|seizure|serotonin toxicity|lithium toxicity/i;
    const ROUTE = /\b000\b|13\s*11\s*14|13\s*11\s*26|emergency department/i;
    for (const sheet of factsheets) {
      cleanup();
      render(<FactsheetDetailPage factsheet={sheet} />);
      const body = screenText();
      if (!EMERGENCY.test(body)) continue;
      expect(ROUTE.test(body), `${sheet.slug} names an emergency symptom with no route on screen`).toBe(true);
    }
  });
});

describe("crisis numbers come from one source", () => {
  it("renders the shared contacts on a condition sheet rather than a second copy", () => {
    renderSheet("depression");
    const body = screenText();
    for (const contact of FACTSHEET_CRISIS_CONTACTS) {
      expect(body, `${contact.name} must render from the shared constant`).toContain(contact.number);
    }
    expect(body).toContain(FACTSHEET_EMERGENCY_NUMBER);
  });
});
