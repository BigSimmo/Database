import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SharedHomeEmptyState } from "@/components/clinical-dashboard/answer-status";
import { appModeIds, type AppModeId } from "@/lib/app-modes";

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const expectedPresentations = [
  {
    modeId: "answer",
    title: "Clinical Answers",
    iconClass: "lucide-sparkles",
  },
  {
    modeId: "documents",
    title: "Clinical Documents",
    iconClass: "lucide-file-text",
  },
  {
    modeId: "services",
    title: "Clinical Services",
    iconClass: "lucide-route",
  },
  {
    modeId: "forms",
    title: "Clinical Forms",
    iconClass: "lucide-file-pen-line",
  },
  {
    modeId: "favourites",
    title: "Clinical Favourites",
    iconClass: "lucide-heart",
  },
  {
    modeId: "differentials",
    title: "Differential Diagnosis",
    iconClass: "lucide-brain-circuit",
  },
  {
    modeId: "dsm",
    title: "DSM-5 Diagnosis",
    iconClass: "lucide-book-open-check",
  },
  {
    modeId: "specifiers",
    title: "Diagnostic Specifiers",
    iconClass: "lucide-tags",
  },
  {
    modeId: "formulation",
    title: "Clinical Formulation",
    iconClass: "lucide-network",
  },
  {
    modeId: "prescribing",
    title: "Medication Guidance",
    iconClass: "lucide-pill",
  },
  {
    modeId: "tools",
    title: "Clinical Tools",
    iconClass: "lucide-wrench",
  },
  {
    modeId: "therapy-compass",
    title: "Therapy Compass",
    iconClass: "lucide-compass",
  },
  {
    modeId: "factsheets",
    title: "Patient Factsheets",
    iconClass: "lucide-book-open-text",
  },
] as const satisfies ReadonlyArray<{
  modeId: AppModeId;
  title: string;
  iconClass: string;
}>;

describe("SharedHomeEmptyState", () => {
  it("covers every current app mode exactly once", () => {
    expect(expectedPresentations.map(({ modeId }) => modeId)).toEqual(appModeIds);
  });

  it.each(expectedPresentations)("renders the canonical $modeId presentation", ({ modeId, title, iconClass }) => {
    const { container } = render(<SharedHomeEmptyState modeId={modeId} />);

    expect(screen.getByTestId("shared-home-empty-state")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    expect(container.querySelector("h2 + p")).not.toBeInTheDocument();

    const icon = container.querySelector(".mode-home-icon svg");
    expect(icon).toHaveClass(iconClass);
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("reserves the phone copy height once on the pair, never on each half", () => {
    const { container } = render(<SharedHomeEmptyState modeId="answer" />);

    const heading = screen.getByRole("heading", { level: 2, name: "What can I help with?" });
    const subtitle = screen.getByText("Ask a source-backed clinical question.", { exact: true });
    const copyWrapper = heading.parentElement;

    expect(copyWrapper).not.toBeNull();
    expect(subtitle.parentElement).toBe(copyWrapper);

    // The reserve belongs to the wrapping pair. Split across the two children
    // (the old `max-sm:min-h-[2lh]` on each) half of each element's unused
    // reserve collects between them, which rendered the subtitle 27px from its
    // own title while the medallion sat 6px away.
    expect(copyWrapper?.className).toContain("max-sm:min-h-[var(--mode-home-copy-reserve)]");
    expect(copyWrapper?.className).toContain("max-sm:content-center");
    for (const el of [heading, subtitle]) {
      expect(el.className).not.toContain("min-h-[2lh]");
      expect(el.className).not.toContain("max-sm:place-items-center");
    }

    // The medallion tracks the fluid token rather than stepping at sm/lg, so
    // the 768-1023px tablet band stops being served the phone size.
    const medallion = container.querySelector(".mode-home-icon");
    expect(medallion?.className).toContain("size-hero-medallion");
    expect(medallion?.className).not.toContain("h-tap w-tap");
  });

  it("keeps the copy reserve banded to the measured wrap points", () => {
    const globalsSource = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    // Bands measured in Chromium across every title/subtitle pair in
    // src/lib/ui-copy.ts. If copy changes push a mode onto another line the
    // band it belongs to must move with it, or the mode toggle jumps again.
    const oneByOne = "calc(var(--text-hero) * var(--leading-display) + 0.25rem + 1.25rem)";
    const twoByOne = "calc(2 * var(--text-hero) * var(--leading-display) + 0.25rem + 1.25rem)";
    const twoByTwo = "calc(2 * var(--text-hero) * var(--leading-display) + 0.25rem + 2 * 1.25rem)";

    expect(globalsSource).toContain(`--mode-home-copy-reserve: ${twoByOne}`);
    expect(globalsSource).toMatch(
      new RegExp(`@media \\(max-width: 322px\\)[\\s\\S]{0,120}--mode-home-copy-reserve: ${escapeForRegExp(twoByTwo)}`),
    );
    expect(globalsSource).toMatch(
      new RegExp(`@media \\(min-width: 412px\\)[\\s\\S]{0,120}--mode-home-copy-reserve: ${escapeForRegExp(oneByOne)}`),
    );
  });

  it("updates the same shared-home root when the active mode changes", () => {
    const { rerender } = render(<SharedHomeEmptyState modeId="answer" />);
    const sharedHomeRoot = screen.getByTestId("shared-home-empty-state");

    expect(sharedHomeRoot.querySelector(".mode-home-icon svg")).toHaveClass("lucide-sparkles");

    rerender(<SharedHomeEmptyState modeId="services" />);

    expect(screen.getByTestId("shared-home-empty-state")).toBe(sharedHomeRoot);
    expect(screen.getByRole("heading", { level: 2, name: "Clinical Services" })).toBeInTheDocument();
    expect(sharedHomeRoot.querySelector(".mode-home-icon svg")).toHaveClass("lucide-route");
    expect(screen.queryByText("What can I help with?", { exact: true })).not.toBeInTheDocument();
  });
});
