import fc from "fast-check";
import "./property-seed";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentFrame } from "@/components/ui/document-frame";

describe("property: DocumentFrame controlled viewing state", () => {
  it("clamps arbitrary zoom values and never applies the viewing aid while zoomed", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -400, max: 800 }),
        fc.boolean(),
        fc.boolean(),
        (zoomPercent, fitWidth, viewingAid) => {
          const { container, unmount } = render(
            <DocumentFrame
              alt="Generated source page"
              src={{ kind: "pdf-page", page: 1 }}
              state="ready"
              controls={{
                fitWidth,
                onFitWidth: vi.fn(),
                zoom: zoomPercent / 100,
                onZoomChange: vi.fn(),
                viewingAid,
                onViewingAidChange: vi.fn(),
              }}
            >
              <canvas aria-label="Generated source page" />
            </DocumentFrame>,
          );

          const frame = container.querySelector<HTMLElement>("[data-document-frame]");
          const output = container.querySelector<HTMLOutputElement>('output[aria-label="Document zoom"]');
          const renderedPercent = Number(output?.textContent?.replace("%", ""));
          expect(renderedPercent).toBeGreaterThanOrEqual(55);
          expect(renderedPercent).toBeLessThanOrEqual(400);
          expect(frame?.dataset.viewingAid).toBe(viewingAid && fitWidth ? "on" : "off");
          unmount();
        },
      ),
      { numRuns: 40 },
    );
  });
});
