import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/caring-contacts/workspace/empty-state";

describe("EmptyState — no-data", () => {
  it("renders the heading and the explanation, and no Why/What-changes-it pair", () => {
    const { container } = render(
      <EmptyState kind="no-data" heading="No patients yet" explanation="Add the first patient to get started." />,
    );
    expect(screen.getByText("No patients yet")).toBeInTheDocument();
    expect(screen.getByText("Add the first patient to get started.")).toBeInTheDocument();
    // The "filtered" wording shape must never leak onto a genuinely empty list —
    // that would misstate a caseload of zero as a caseload hidden by a filter.
    expect(container.textContent ?? "").not.toContain("Why:");
    expect(container.textContent ?? "").not.toContain("What changes it:");
  });

  it("renders no action when none is given", () => {
    const { container } = render(<EmptyState kind="no-data" heading="No patients yet" explanation="Nothing here." />);
    expect(container.querySelector("a, button")).toBeNull();
  });

  it("renders the given action, and it is genuinely actionable", () => {
    render(
      <EmptyState
        kind="no-data"
        heading="No patients yet"
        explanation="Add the first patient to get started."
        action={<a href="/caring-contacts/patients/new">Add a patient</a>}
      />,
    );
    const action = screen.getByRole("link", { name: "Add a patient" });
    expect(action).toHaveAttribute("href", "/caring-contacts/patients/new");
  });
});

describe("EmptyState — filtered", () => {
  it("renders both the reason and the remedy in the page, never in a title alone", () => {
    // Mirrors how tests/caring-contacts-explained-automation.dom.test.tsx proves
    // AutomatedState's reason and remedy are not tooltip-only: nothing here may
    // be reachable only by hovering a `title`.
    const { container } = render(
      <EmptyState
        kind="filtered"
        heading="No patients match"
        because="The status filter is set to Discharged this week."
        changedBy="Clear the status filter to see the rest of the caseload."
      />,
    );
    expect(container.textContent ?? "").toContain("Why:");
    expect(container.textContent ?? "").toContain("The status filter is set to Discharged this week.");
    expect(container.textContent ?? "").toContain("What changes it:");
    expect(container.textContent ?? "").toContain("Clear the status filter to see the rest of the caseload.");
    for (const node of container.querySelectorAll("[title]")) {
      expect(node.getAttribute("title")).not.toContain("The status filter is set to Discharged this week.");
      expect(node.getAttribute("title")).not.toContain("Clear the status filter to see the rest of the caseload.");
    }
  });

  it("cannot be constructed without a reason and a remedy", () => {
    // A type-level guarantee, checked by `tsc --noEmit` rather than at runtime:
    // the discriminated union makes `because`/`changedBy` required the moment
    // `kind` is "filtered", so an omission is a compile error, not a judgement
    // call left to whoever writes the next list screen.
    const omittedBecause = (
      // @ts-expect-error "filtered" requires `because` — it cannot be left out.
      <EmptyState kind="filtered" heading="No patients match" changedBy="Clear the status filter." />
    );
    const omittedChangedBy = (
      // @ts-expect-error "filtered" requires `changedBy` — it cannot be left out.
      <EmptyState kind="filtered" heading="No patients match" because="The status filter hides everyone." />
    );
    expect(omittedBecause).toBeTruthy();
    expect(omittedChangedBy).toBeTruthy();
  });

  it("renders the given action, and it is genuinely actionable", () => {
    render(
      <EmptyState
        kind="filtered"
        heading="No patients match"
        because="The status filter is set to Discharged this week."
        changedBy="Clear the status filter to see the rest of the caseload."
        action={<a href="/caring-contacts/patients">Clear filter</a>}
      />,
    );
    const action = screen.getByRole("link", { name: "Clear filter" });
    expect(action).toHaveAttribute("href", "/caring-contacts/patients");
  });
});

describe("EmptyState — rendering", () => {
  it("renders correctly inside a 320px-wide container", () => {
    const { container } = render(
      <div style={{ width: "320px" }}>
        <EmptyState
          kind="filtered"
          heading="No patients match"
          because="The status filter is set to Discharged this week, which happens to be a fairly long sentence."
          changedBy="Clear the status filter to see the rest of the caseload, which is also fairly long."
        />
      </div>,
    );
    // Text wraps rather than escaping its measure — the same contract
    // `automated-state.tsx` holds with `max-w-[var(--measure)]`.
    for (const paragraph of container.querySelectorAll("p")) {
      if (paragraph.textContent && paragraph.textContent.length > 40) {
        expect(paragraph.className).toContain("max-w-[var(--measure)]");
      }
    }
    expect(screen.getByText("No patients match")).toBeInTheDocument();
  });

  it("keeps its border visible under forced colours, the way automated-state.tsx does", () => {
    // jsdom cannot emulate `forced-colors: active`; real browser proof for this
    // family of guarantee lives in tests/ui-caring-contacts-workspace.spec.ts.
    // What this DOM test can and does prove is that the override class this
    // repo's forced-colors contract depends on is actually present in the
    // rendered markup, not merely written somewhere in the source.
    const { container } = render(<EmptyState kind="no-data" heading="No patients yet" explanation="Nothing here." />);
    const region = container.firstElementChild;
    expect(region).not.toBeNull();
    expect(region!.className).toContain("forced-colors:border-[CanvasText]");
  });

  it("never carries the state by colour alone: the icon is decorative and the words are the state", () => {
    const { container } = render(<EmptyState kind="no-data" heading="No patients yet" explanation="Nothing here." />);
    const icons = container.querySelectorAll("svg");
    expect(icons, "no-data renders no icon").toHaveLength(1);
    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });
});
