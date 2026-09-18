/**
 * #3CJPX5 — the calculators page showed the shared home's title.
 *
 * Nothing in this repository asserted a page title before this file. The
 * shared-home title is written imperatively (the mode pill uses
 * `history.replaceState`, so server metadata cannot update on that path), and
 * an imperative write outlives its writer: whatever mode was last selected on
 * `/` was still in the tab on `/calculators/search`, a route that declares its
 * own metadata.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSharedHomeDocumentTitle } from "@/components/clinical-dashboard/use-shared-home-document-title";

function TitleProbe({ active, mode }: { active: boolean; mode: "calculators" | "forms" }) {
  useSharedHomeDocumentTitle(active, mode);
  return null;
}

describe("useSharedHomeDocumentTitle", () => {
  it("writes the selected mode's title while the shared home owns it", () => {
    document.title = "PsychSift";
    render(<TitleProbe active mode="calculators" />);
    expect(document.title).toBe("Clinical Calculators | PsychSift");
  });

  it("tracks the mode pill without losing the route title underneath", () => {
    document.title = "PsychSift";
    const view = render(<TitleProbe active mode="calculators" />);
    view.rerender(<TitleProbe active mode="forms" />);
    expect(document.title).toBe("Clinical Forms | PsychSift");

    view.unmount();
    expect(document.title).toBe("PsychSift");
  });

  it("hands the title back when the shared home stops owning it", () => {
    document.title = "PsychSift";
    const view = render(<TitleProbe active mode="calculators" />);
    expect(document.title).toBe("Clinical Calculators | PsychSift");

    view.rerender(<TitleProbe active={false} mode="calculators" />);
    expect(document.title).toBe("PsychSift");
  });

  it("leaves a title the next route already claimed alone", () => {
    // The restore and the next route's metadata land at the same moment and the
    // order is not ours to pick, so the hand-back is conditional. This is the
    // case that would otherwise reintroduce #3CJPX5 pointing the other way.
    document.title = "PsychSift";
    const view = render(<TitleProbe active mode="calculators" />);
    document.title = "Search clinical calculators | PsychSift";

    view.unmount();
    expect(document.title).toBe("Search clinical calculators | PsychSift");
  });
});
