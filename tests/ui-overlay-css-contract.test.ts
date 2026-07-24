import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const answerResultSurfaceSource = read("src/components/clinical-dashboard/answer-result-surface.tsx");
const sheetSource = read("src/components/ui/sheet.tsx");
const globalStylesSource = read("src/app/globals.css");

function occurrenceCount(source: string, value: string) {
  return source.split(value).length - 1;
}

describe("overlay and global CSS contracts", () => {
  it("uses the Sheet semantic backdrop without answer-surface call-site overrides", () => {
    expect(sheetSource).toContain("bg-[color:var(--overlay-backdrop)]");
    expect(answerResultSurfaceSource).not.toContain("desktopBackdropClassName=");
    expect(answerResultSurfaceSource).not.toContain("sm:bg-black/50");
  });

  it("dismisses the Sheet backdrop only when the gesture starts on the dimmed area", () => {
    expect(sheetSource).toContain("backdropPointerDownRef");
    expect(sheetSource).toContain("backdropPointerDownRef.current = event.target === event.currentTarget");
    expect(sheetSource).toContain(
      "if (event.target !== event.currentTarget || !backdropPointerDownRef.current) return",
    );
  });

  it("defines the shared easing tokens only once", () => {
    expect(occurrenceCount(globalStylesSource, "--ease-standard:")).toBe(1);
    expect(occurrenceCount(globalStylesSource, "--ease-emphasized:")).toBe(1);
  });

  it("keeps one authoritative 430px composer-action sizing block", () => {
    expect(occurrenceCount(globalStylesSource, "@media (max-width: 430px)")).toBe(1);
    expect(globalStylesSource).toMatch(
      /@media \(max-width: 430px\) \{[\s\S]*?\.chat-composer-icon-button,[\s\S]*?min-height: 2\.75rem;[\s\S]*?\.chat-composer-icon-button svg,[\s\S]*?height: 1\.1rem;/,
    );
  });

  it("lets contextual composer surfaces own their resting and focus border colors", () => {
    const baseBlock = globalStylesSource.match(/\.chat-composer-shell-base\s*\{[\s\S]*?\}/)?.[0] ?? "";

    expect(baseBlock).toContain("border-width: 1px");
    expect(baseBlock).toContain("border-style: solid");
    expect(baseBlock).not.toMatch(/\bborder\s*:/);
    expect(baseBlock).not.toContain("border-color:");
    expect(globalStylesSource).toMatch(/\.answer-footer-search-pill:focus-within\s*\{[\s\S]*?border-color:/);
  });

  it("keeps phone header edge padding tokenized and never zeroed by unlayered media", () => {
    // --header-edge-pad is the single phone/sm inset shared by the layered
    // .edge-glass-header base and the unlayered max-width:639px guard. A bare
    // max(0px, safe-area) override previously pinned new-chat to the bezel.
    expect(occurrenceCount(globalStylesSource, "--header-edge-pad:")).toBe(1);
    expect(globalStylesSource).toMatch(/--header-edge-pad:\s*1rem;/);
    expect(occurrenceCount(globalStylesSource, "max(var(--header-edge-pad), var(--safe-area-left))")).toBe(2);
    expect(occurrenceCount(globalStylesSource, "max(var(--header-edge-pad), var(--safe-area-right))")).toBe(2);
    expect(globalStylesSource).not.toMatch(
      /\.edge-glass-header\s*\{[^}]*padding-left:\s*max\(0px,\s*var\(--safe-area-left\)\)/s,
    );
  });

  it("keeps hidden phone composers from reserving or painting a bottom white band", () => {
    expect(globalStylesSource).toMatch(/--phone-dock-hidden-pad:\s*0rem;/);
    expect(globalStylesSource).not.toContain("--phone-dock-hidden-pad: 0.75rem");
    expect(read("src/components/clinical-dashboard/mobile-composer-reserve.ts")).toContain(
      'export const mobileComposerHiddenReserve = "0rem"',
    );
    expect(read("src/components/DocumentViewer.tsx")).toContain(
      'composerScrollHidden ? "max-sm:pb-0" : "max-sm:pb-[calc(9rem+var(--safe-area-bottom))]"',
    );
  });
});
