import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { ErrorSummary, FormField } from "@/components/ui/form-field";

function Field(props: Partial<ComponentProps<typeof FormField>>) {
  return (
    <FormField label="Review date" {...props}>
      {(field) => (
        <input
          id={field.id}
          aria-describedby={field.describedBy}
          aria-invalid={field.invalid || undefined}
          required={field.required}
          autoComplete={field.autoComplete}
        />
      )}
    </FormField>
  );
}

describe("FormField", () => {
  it("keeps the hint in the DOM when the field goes invalid", () => {
    // The defect this shell exists to fix: the user is told they are wrong at
    // exactly the moment the statement of what right looks like disappears.
    render(<Field hint="DD/MM/YYYY" error="That date does not exist." />);

    expect(screen.getByTestId("field-hint")).toHaveTextContent("DD/MM/YYYY");
    expect(screen.getByTestId("field-error")).toHaveTextContent("That date does not exist.");
  });

  it("describes the control with both the hint and the error when invalid", () => {
    render(<Field hint="DD/MM/YYYY" error="That date does not exist." />);

    const input = screen.getByLabelText(/Review date/);
    const ids = (input.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0] as string)).toHaveTextContent("DD/MM/YYYY");
    expect(document.getElementById(ids[1] as string)).toHaveTextContent("That date does not exist.");
  });

  it("merges caller describedBy ahead of the hint instead of overwriting it", () => {
    render(
      <>
        <p id="caller-note">Dates are recorded in Perth time.</p>
        <Field describedBy="caller-note" hint="DD/MM/YYYY" />
      </>,
    );

    const ids = (screen.getByLabelText(/Review date/).getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids[0]).toBe("caller-note");
    expect(ids).toHaveLength(2);
  });

  it("honours an externally supplied id so a caller can link to the field", () => {
    render(<Field id="review-date" />);
    expect(screen.getByLabelText(/Review date/)).toHaveAttribute("id", "review-date");
  });

  it("marks required and optional in the label text, never by colour alone", () => {
    const { rerender } = render(<Field required />);
    expect(screen.getByText(/Review date/).textContent).toContain("(required)");

    rerender(<Field />);
    expect(screen.getByText(/Review date/).textContent).toContain("(optional)");
  });

  it("passes autocomplete guidance through to the rendered control", () => {
    render(<Field autoComplete="bday" />);
    expect(screen.getByLabelText(/Review date/)).toHaveAttribute("autocomplete", "bday");
  });

  it("announces the error through role=alert and pairs it with an icon", () => {
    render(<Field error="That date does not exist." />);

    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("That date does not exist.");
    // Text plus icon: red alone survives neither forced colours nor greyscale.
    expect(error.querySelector("svg")).not.toBeNull();
  });

  it("marks the control invalid only when an error is present", () => {
    const { rerender } = render(<Field hint="DD/MM/YYYY" />);
    expect(screen.getByLabelText(/Review date/)).not.toHaveAttribute("aria-invalid");

    rerender(<Field hint="DD/MM/YYYY" error="Nope." />);
    expect(screen.getByLabelText(/Review date/)).toHaveAttribute("aria-invalid", "true");
  });
});

describe("ErrorSummary", () => {
  const errors = [{ fieldId: "review-date", label: "Review date", message: "That date does not exist." }];

  it("renders nothing when the form is clean", () => {
    render(<ErrorSummary errors={[]} />);
    expect(screen.queryByTestId("error-summary")).not.toBeInTheDocument();
  });

  it("takes focus itself rather than announcing through a live region", () => {
    render(<ErrorSummary errors={errors} />);

    const summary = screen.getByTestId("error-summary");
    expect(summary).toHaveFocus();
    // Focus movement is the announcement; a live region as well would read twice.
    expect(summary).not.toHaveAttribute("aria-live");
  });

  it("moves focus into the field its entry names", async () => {
    render(
      <>
        <ErrorSummary errors={errors} />
        <Field id="review-date" error="That date does not exist." />
      </>,
    );

    await userEvent.click(screen.getByTestId("error-summary-link"));
    expect(screen.getByLabelText(/Review date/)).toHaveFocus();
  });

  it("re-focuses the summary on a repeated failed submit with the same errors", () => {
    const { rerender } = render(
      <>
        <button type="button" data-testid="elsewhere">
          Elsewhere
        </button>
        <ErrorSummary errors={errors} attempt={1} />
      </>,
    );

    expect(screen.getByTestId("error-summary")).toHaveFocus();
    screen.getByTestId("elsewhere").focus();
    expect(screen.getByTestId("elsewhere")).toHaveFocus();

    // Same field IDs and count — without `attempt`, the effect would not re-run.
    rerender(
      <>
        <button type="button" data-testid="elsewhere">
          Elsewhere
        </button>
        <ErrorSummary errors={errors} attempt={2} />
      </>,
    );

    expect(screen.getByTestId("error-summary")).toHaveFocus();
  });
});
