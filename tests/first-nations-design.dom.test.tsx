/** @vitest-environment jsdom */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BedsideHomeView } from "@/components/first-nations/bedside-home";
import { InnerPageView } from "@/components/first-nations/inner-page";
import { buildInnerPageModel } from "@/lib/first-nations/view-model";
import { testInputs } from "./fixtures/first-nations-content";
import { bedsideFixture, resetAfterEach } from "./fixtures/first-nations-models";

vi.mock("@/components/first-nations/kit", async () => await import("./fixtures/first-nations-kit-double"));
vi.mock("@/components/first-nations/first-nations-nav-header", () => ({ FirstNationsNavHeader: () => null }));
vi.mock("@/components/first-nations/page-menu", () => ({
  FirstNationsHomeMenu: () => null,
  FirstNationsMenuActions: () => null,
}));
vi.mock("@/components/first-nations/primer", () => ({ Primer: () => null, PRIMER_EVENT: "x" }));
vi.mock("next/navigation", () => ({ usePathname: () => "/first-nations" }));
resetAfterEach();

const DIR = "src/components/first-nations";
const APP_DIR = "src/app/(search-app)/first-nations";
const files = [
  ...readdirSync(DIR).map((f) => ({ f, text: readFileSync(join(DIR, f), "utf8") })),
  { f: "error.tsx", text: readFileSync(join(APP_DIR, "error.tsx"), "utf8") },
];
const SIZE_CLASSES = ["text-2xs", "text-sm-minus", "text-base-minus", "text-lg-minus", "fn-display-36"];

/** Size steps used inside `root`, leaving out the desktop-only plan panel (its own column with a sheet-sized title). */
function sizesIn(root: Element): string[] {
  return SIZE_CLASSES.filter((c) =>
    [...root.querySelectorAll(`.${c}`)].some((el) => !el.closest("[data-fn-part='plan-panel']")),
  );
}

describe("First Nations design guard (standard v13.1)", () => {
  it("uses nothing heavier than semibold", () => {
    for (const { f, text } of files)
      expect(text, f).not.toMatch(/\bfont-(bold|extrabold|black)\b|font-weight:\s*[7-9]00/);
  });
  it("uses only the scale's size steps", () => {
    for (const { f, text } of files)
      expect(text, f).not.toMatch(/\btext-(3xs|xs|sm|base|lg|xl|[2-9]xl)\b(?!-)|\btext-\[\d/);
  });
  it("keeps the serif accent inside voice.tsx", () => {
    for (const { f, text } of files) if (f !== "voice.tsx") expect(text, f).not.toMatch(/fn-voice/);
  });
  it("uses the mode colour only in the allowed places", () => {
    const allowed = new Set(["module-header.tsx", "day-track.tsx", "voice.tsx", "first-nations-nav-header.tsx"]);
    for (const { f, text } of files) if (!allowed.has(f)) expect(text, f).not.toMatch(/mode-identity|modeIdentity/);
  });
  it("gives tabs no count badges", () => {
    for (const { f, text } of files) expect(text, f).not.toMatch(/\b(badge|count)=\{/);
  });
  it("shows at most four type sizes and one filled button on Bedside", () => {
    const { container } = render(<BedsideHomeView model={bedsideFixture().model} />);
    const used = sizesIn(container);
    expect(used.length, used.join(", ")).toBeLessThanOrEqual(4);
    expect(container.querySelectorAll("[data-fn-filled], [data-variant='primary']").length).toBeLessThanOrEqual(1);
  });
  it("shows at most four type sizes and no filled button on an inner page", () => {
    const { container } = render(<InnerPageView model={buildInnerPageModel(testInputs(), "talking")} />);
    const used = sizesIn(container);
    expect(used.length, used.join(", ")).toBeLessThanOrEqual(4);
    expect(container.querySelectorAll("[data-fn-filled]").length).toBe(0);
  });
});
