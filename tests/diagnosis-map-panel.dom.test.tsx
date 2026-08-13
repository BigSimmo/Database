import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DiagnosisMapPanel } from "@/components/differentials/diagnosis-map-panel";
import { OverlayRoot } from "@/components/ui/overlay-root";
import type { DifferentialRelatedMapDetail } from "@/lib/differential-detail";
import type { DifferentialRecord } from "@/lib/differentials";

const record: DifferentialRecord = {
  slug: "focus-diagnosis",
  title: "Focus diagnosis",
  status: "urgent",
  subtitle: "Focus subtitle",
  clinicalHinge: "Focus clinical hinge.",
  safetySnapshot: { summary: "Focus safety summary.", tags: ["Focus risk"] },
  sections: [],
  related: [
    {
      id: "verified-related",
      label: "Verified related diagnosis with a long readable label",
      likelihood: "possible",
      note: "Relationship note for the verified diagnosis.",
    },
    {
      id: "unresolved-related",
      label: "Unresolved related diagnosis",
      likelihood: "less-likely",
      note: "Relationship-only note.",
    },
    {
      id: "dangerous-related",
      label: "Dangerous related diagnosis",
      likelihood: "must-not-miss",
      note: "Urgent relationship note.",
    },
  ],
  currentPresentation: [],
  investigations: [],
  immediateActions: [],
};

const relatedMapDetails: Record<string, DifferentialRelatedMapDetail> = {
  "verified-related": {
    slug: "verified-related",
    title: "Verified related diagnosis with a long readable label",
    status: "emergent",
    clinicalHinge: "The verified diagnosis has its own clinical hinge.",
    safetySummary: "The verified diagnosis has its own safety summary.",
  },
  "dangerous-related": {
    slug: "dangerous-related",
    title: "Dangerous related diagnosis",
    status: "emergent",
    clinicalHinge: "Dangerous diagnosis hinge.",
    safetySummary: "Dangerous diagnosis safety summary.",
  },
};

let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect;
let originalResizeObserver: typeof ResizeObserver | undefined;
let originalRequestAnimationFrame: typeof window.requestAnimationFrame | undefined;
let originalCancelAnimationFrame: typeof window.cancelAnimationFrame | undefined;

beforeEach(() => {
  originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  originalResizeObserver = globalThis.ResizeObserver;
  originalRequestAnimationFrame = window.requestAnimationFrame;
  originalCancelAnimationFrame = window.cancelAnimationFrame;
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (
      this instanceof HTMLElement &&
      ["diagnosis-map-preview-canvas", "diagnosis-map-full-canvas"].includes(this.dataset.testid ?? "")
    ) {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 390,
        bottom: 520,
        width: 390,
        height: 520,
        toJSON: () => ({}),
      } as DOMRect;
    }
    return originalGetBoundingClientRect.call(this);
  };
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
  window.requestAnimationFrame ??= (callback) => window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame ??= window.clearTimeout;
});

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  if (originalResizeObserver) globalThis.ResizeObserver = originalResizeObserver;
  else Reflect.deleteProperty(globalThis, "ResizeObserver");
  if (originalRequestAnimationFrame) window.requestAnimationFrame = originalRequestAnimationFrame;
  else Reflect.deleteProperty(window, "requestAnimationFrame");
  if (originalCancelAnimationFrame) window.cancelAnimationFrame = originalCancelAnimationFrame;
  else Reflect.deleteProperty(window, "cancelAnimationFrame");
  document.body.style.overflow = "";
});

function renderMap() {
  return render(
    <>
      <OverlayRoot />
      <DiagnosisMapPanel record={record} relatedMapDetails={relatedMapDetails} />
    </>,
  );
}

describe("DiagnosisMapPanel", () => {
  it("shows selected-node clinical content, honest actions, and a collapsible in-flow inspector", async () => {
    const user = userEvent.setup();
    renderMap();

    expect(screen.getByLabelText("Map legend")).toHaveTextContent("Focus diagnosis");
    await user.click(screen.getByTestId("open-diagnosis-map"));

    const dialog = await screen.findByTestId("diagnosis-map-dialog");
    expect(within(dialog).getByRole("button", { name: "Must-not-miss" })).toBeInTheDocument();

    await user.click(within(dialog).getByTestId("diagnosis-map-node-verified-related"));
    const inspector = within(dialog).getByTestId("diagnosis-map-node-details");
    expect(within(inspector).getByText("Relationship note for the verified diagnosis.")).toBeInTheDocument();
    expect(within(inspector).getByText("The verified diagnosis has its own clinical hinge.")).toBeInTheDocument();
    expect(within(inspector).getByText("The verified diagnosis has its own safety summary.")).toBeInTheDocument();
    expect(within(inspector).queryByText("Focus safety summary.")).not.toBeInTheDocument();
    expect(within(inspector).getByRole("link", { name: "Open diagnosis" })).toHaveAttribute(
      "href",
      "/differentials/diagnoses/verified-related",
    );
    expect(within(inspector).getByRole("button", { name: "Collapse selected diagnosis details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.click(within(inspector).getByRole("button", { name: "Add to compare" }));
    expect(within(inspector).getByRole("link", { name: "Compare (2)" })).toHaveAttribute(
      "href",
      "/differentials/compare?ids=focus-diagnosis%2Cverified-related",
    );

    await user.click(within(dialog).getByTestId("diagnosis-map-node-unresolved-related"));
    expect(within(inspector).getByText(/does not currently resolve to a reviewed catalogue page/i)).toBeInTheDocument();
    expect(within(inspector).queryByRole("link", { name: "Open diagnosis" })).not.toBeInTheDocument();
    expect(within(inspector).getByText("Catalogue page unavailable")).toBeInTheDocument();
  });

  it("refits and returns selection to the focus diagnosis when filtering hides the selected node", async () => {
    const user = userEvent.setup();
    renderMap();
    await user.click(screen.getByTestId("open-diagnosis-map"));
    const dialog = await screen.findByTestId("diagnosis-map-dialog");

    await user.click(within(dialog).getByTestId("diagnosis-map-node-verified-related"));
    await user.click(within(dialog).getByRole("button", { name: "Must-not-miss" }));

    await waitFor(() => {
      expect(within(dialog).queryByTestId("diagnosis-map-node-verified-related")).not.toBeInTheDocument();
    });
    expect(within(dialog).getByTestId("diagnosis-map-node-diagnosis")).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByText(/Showing 1 must-not-miss differential/)).toBeInTheDocument();
  });
});
