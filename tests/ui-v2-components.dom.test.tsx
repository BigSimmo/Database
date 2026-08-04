import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Info } from "lucide-react";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { AnswerFooter, DoseLine } from "@/components/ui/answer-card";
import { Button } from "@/components/ui/button";
import { Citation } from "@/components/ui/citation";
import { Chip } from "@/components/ui/chip";
import { Checkbox, RadioGroup } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { SearchField, TextField } from "@/components/ui/text-field";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";

describe("Button", () => {
  it("folds the busy contract in: disabled, announced, and relabelled", () => {
    render(
      <Button variant="primary" busy busyLabel="Reindexing…">
        Reindex
      </Button>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("Reindexing…");
  });

  it("defaults to type=button so it cannot submit a surrounding form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("TextField / SearchField", () => {
  it("wires hint text through aria-describedby", () => {
    render(<TextField label="Publisher" hint="As printed on the source." />);

    // Only required fields carry a marker in the label text, so an optional
    // field's accessible name stays "Publisher".
    const input = screen.getByLabelText(/Publisher/);
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent("As printed on the source.");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("keeps the hint alongside the error and marks the field invalid", () => {
    // Flipped with the PR 13 fold. The old shell swapped the hint out for the
    // error, which took away the statement of the correct format at exactly the
    // moment the user got the format wrong. Folding onto `FormField` keeps both.
    render(<TextField label="Review date" hint="DD/MM/YYYY" error="That date does not exist." />);

    const input = screen.getByLabelText(/Review date/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    const ids = (input.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0] as string)).toHaveTextContent("DD/MM/YYYY");
    expect(document.getElementById(ids[1] as string)).toHaveTextContent("That date does not exist.");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("merges a caller's aria-describedby ahead of its own hint", () => {
    render(
      <>
        <p id="publisher-note">As it appears on the cover.</p>
        <TextField label="Publisher" aria-describedby="publisher-note" hint="As printed on the source." />
      </>,
    );

    const ids = (screen.getByLabelText(/Publisher/).getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids[0]).toBe("publisher-note");
    expect(ids).toHaveLength(2);
  });

  it("honours an externally supplied id so an error summary can link to the field", () => {
    render(<TextField id="publisher" label="Publisher" />);
    expect(screen.getByLabelText(/Publisher/)).toHaveAttribute("id", "publisher");
  });

  it("reaches the input with a caller ref after the fold onto FormField", () => {
    // The fold moved the input inside a render-prop child, so `ref` now travels
    // through the props spread rather than sitting on the component's own
    // element. The settings email field focuses itself through exactly this ref,
    // and a dropped ref is invisible in a diff and in a typecheck.
    const ref = createRef<HTMLInputElement>();
    render(<TextField label="Publisher" ref={ref} />);

    expect(ref.current).toBe(screen.getByLabelText(/Publisher/));
    ref.current?.focus();
    expect(document.activeElement).toBe(screen.getByLabelText(/Publisher/));
  });

  it("only offers the clear control once the search field has a value", async () => {
    const onClear = vi.fn();
    const { rerender } = render(<SearchField label="Search sources" value="" onClear={onClear} onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

    rerender(<SearchField label="Search sources" value="clozapine" onClear={onClear} onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("Chip", () => {
  it("gives each remove control its own label rather than a row of identical ones", async () => {
    const onRemove = vi.fn();
    render(
      <>
        <Chip onRemove={onRemove} removeLabel="Remove WA">
          WA
        </Chip>
        <Chip onRemove={onRemove} removeLabel="Remove Current only">
          Current only
        </Chip>
      </>,
    );

    expect(screen.getByRole("button", { name: "Remove WA" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove Current only" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe("Citation", () => {
  it("activates when interactive and named", async () => {
    const onActivate = vi.fn();
    render(<Citation index={1} label="RANZCP" locator="p. 12" onActivate={onActivate} />);
    await userEvent.click(screen.getByRole("button", { name: /Source 1, RANZCP/ }));
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("renders a static mark when interactive is false", () => {
    render(<Citation index={2} label="NICE" interactive={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByTestId("citation")).toHaveAttribute("aria-label", expect.stringContaining("NICE"));
  });
});

describe("Select", () => {
  // ADOPTION §3: `Select` shipped without a dedicated test. The fold is where
  // that gap closes, because the fold is what makes its shell shared.
  it("keeps the hint alongside the error, like every other folded control", () => {
    render(
      <Select
        label="Jurisdiction"
        hint="Applies to guideline filtering only."
        error="Choose a jurisdiction."
        options={[{ value: "wa", label: "Western Australia" }]}
      />,
    );

    const select = screen.getByLabelText(/Jurisdiction/);
    expect(select).toHaveAttribute("aria-invalid", "true");
    const ids = (select.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0] as string)).toHaveTextContent("Applies to guideline filtering only.");
    expect(document.getElementById(ids[1] as string)).toHaveTextContent("Choose a jurisdiction.");
  });

  it("keeps a hidden label a real label rather than dropping it", () => {
    render(<Select label="Jurisdiction" hideLabel options={[{ value: "wa", label: "Western Australia" }]} />);
    expect(screen.getByRole("combobox")).toHaveAccessibleName(/Jurisdiction/);
  });
});

describe("Checkbox", () => {
  it("merges a caller's description with its own rather than overwriting it", () => {
    render(
      <>
        <p id="outdated-note">Outdated sources stay flagged.</p>
        <Checkbox label="Include outdated sources" description="Off by default." aria-describedby="outdated-note" />
      </>,
    );

    const ids = (screen.getByRole("checkbox").getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(ids[0]).toBe("outdated-note");
    expect(ids).toHaveLength(2);
  });

  it("forwards a caller ref even though the component owns the ref for indeterminate", () => {
    // The component's own ref callback sets `indeterminate`, which exists only on
    // the node. Before this was forwarded by hand, the declared `ref` prop
    // typechecked and then did nothing at all.
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox label="Include outdated sources" indeterminate ref={ref} />);

    expect(ref.current).toBe(screen.getByRole("checkbox"));
    expect(ref.current?.indeterminate).toBe(true);
  });
});

describe("RadioGroup", () => {
  it("keeps controlled value and onChange paired", async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        label="Sort"
        name="sort"
        value="relevance"
        onChange={onChange}
        options={[
          { value: "relevance", label: "Relevance" },
          { value: "newest", label: "Newest" },
        ]}
      />,
    );
    await userEvent.click(screen.getByLabelText("Newest"));
    expect(onChange).toHaveBeenCalledWith("newest");
  });

  it("carries a group-level hint and error together on the fieldset", () => {
    render(
      <RadioGroup
        label="Sort"
        name="sort"
        hint="Applies to this result set only."
        error="Choose a sort order."
        options={[
          { value: "relevance", label: "Relevance" },
          { value: "newest", label: "Newest" },
        ]}
      />,
    );

    const group = screen.getByRole("group", { name: "Sort" });
    const ids = (group.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0] as string)).toHaveTextContent("Applies to this result set only.");
    expect(document.getElementById(ids[1] as string)).toHaveTextContent("Choose a sort order.");
  });

  it("applies the resolved group id to the fieldset when the caller omits id", () => {
    // Without this, callers that omit `id` get a fieldset with no DOM id, so an
    // error summary cannot link to the group and option/hint/error ids still
    // exist under an orphan prefix.
    render(
      <RadioGroup
        label="Sort"
        name="sort"
        options={[
          { value: "relevance", label: "Relevance" },
          { value: "newest", label: "Newest" },
        ]}
      />,
    );

    const group = screen.getByRole("group", { name: "Sort" });
    expect(group).toHaveAttribute("id");
    expect(group.getAttribute("id")?.length).toBeGreaterThan(0);
  });

  it("honours an externally supplied id on the fieldset", () => {
    render(
      <RadioGroup
        id="sort-order"
        label="Sort"
        name="sort"
        options={[
          { value: "relevance", label: "Relevance" },
          { value: "newest", label: "Newest" },
        ]}
      />,
    );

    expect(screen.getByRole("group", { name: "Sort" })).toHaveAttribute("id", "sort-order");
  });

  it("derives option ids from a sanitised key rather than the raw value", () => {
    render(
      <RadioGroup
        label="Creatinine unit"
        name="scr-unit"
        options={[
          { value: "µmol/L", label: "µmol/L" },
          { value: "mg/dL", label: "mg/dL" },
        ]}
      />,
    );

    const ids = ["µmol/L", "mg/dL"].map((name) => screen.getByLabelText(name).getAttribute("id") ?? "");
    for (const id of ids) {
      // A raw value carrying "/" or "µ" produces an id fragment a selector
      // cannot address, and two values that sanitise alike would collide.
      expect(id).not.toContain("/");
      expect(id).not.toContain("µ");
    }
    expect(new Set(ids).size).toBe(2);
  });
});

describe("Tabs", () => {
  const items = [
    { id: "answer", label: "Answer" },
    { id: "sources", label: "Sources" },
    { id: "audit", label: "Audit" },
  ];

  function Harness() {
    const [value, setValue] = useState("answer");
    return (
      <Tabs label="Answer sections" items={items} value={value} onChange={setValue}>
        <p>panel for {value}</p>
      </Tabs>
    );
  }

  it("keeps exactly one tab in the tab order and moves selection with arrow keys", async () => {
    render(<Harness />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.filter((tab) => tab.getAttribute("tabindex") === "0")).toHaveLength(1);

    tabs[0].focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Sources" })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Audit" })).toHaveAttribute("aria-selected", "true");
  });

  it("links the panel back to its tab", () => {
    render(<Harness />);
    const panel = screen.getByRole("tabpanel");
    const tab = screen.getByRole("tab", { name: "Answer" });
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    expect(tab).toHaveAttribute("aria-controls", panel.id);
  });

  it("does not point unselected tabs at missing panel ids", () => {
    render(<Harness />);
    const selected = screen.getByRole("tab", { name: "Answer" });
    const other = screen.getByRole("tab", { name: "Sources" });
    expect(selected).toHaveAttribute("aria-controls");
    expect(other).not.toHaveAttribute("aria-controls");
  });
});

describe("Tooltip", () => {
  it("opens on keyboard focus, not hover alone, and describes the trigger", async () => {
    render(
      <Tooltip content="Provenance is read from the document.">
        <button type="button">
          <Info aria-hidden="true" /> About
        </button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    trigger.focus();
    const tooltip = await screen.findByRole("tooltip");
    expect(trigger.getAttribute("aria-describedby")).toBe(tooltip.id);
  });

  it("composes over existing child event handlers instead of replacing them", async () => {
    const onFocus = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <Tooltip content="Extra detail">
        <button type="button" onFocus={onFocus} onKeyDown={onKeyDown}>
          Trigger
        </button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button");
    trigger.focus();
    await screen.findByRole("tooltip");
    expect(onFocus).toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
    expect(onKeyDown).toHaveBeenCalled();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("marks the current page and truncates a long list", () => {
    render(<Pagination page={9} pageCount={42} onPageChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Page 9" })).toHaveAttribute("aria-current", "page");
    // First, last and the band around the current page — not all 42.
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 42" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Page 20" })).not.toBeInTheDocument();
  });

  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination page={1} pageCount={1} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ConfirmDialog", () => {
  it("holds the destructive action until the confirmation phrase matches exactly", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onCancel={() => {}}
        onConfirm={onConfirm}
        title="Retire approved guideline?"
        description="This removes the guideline from future answers."
        confirmLabel="Retire guideline"
        confirmPhrase="RETIRE"
      />,
    );

    const confirm = screen.getByRole("button", { name: "Retire guideline" });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox"), "retire");
    expect(confirm).toBeDisabled(); // case-sensitive on purpose

    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "RETIRE");
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe("Toast", () => {
  function Harness() {
    const { push } = useToast();
    return (
      <button type="button" onClick={() => push({ tone: "success", title: "Source indexed", duration: 0 })}>
        Announce
      </button>
    );
  }

  it("announces politely through a live region", async () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    const region = screen.getByTestId("toast-region");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("role", "status");

    await userEvent.click(screen.getByRole("button", { name: "Announce" }));
    expect(within(region).getByText("Source indexed")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss: Source indexed" }));
    expect(within(region).queryByText("Source indexed")).not.toBeInTheDocument();
  });
});

describe("DoseLine", () => {
  it("keeps the unit in its authored case — g is not G, mg is not MG", () => {
    render(
      <DoseLine
        rows={[{ id: "clozapine", drug: "Clozapine", dose: { value: "12.5", unit: "mg" }, status: "current" }]}
        onOpenSource={vi.fn()}
      />,
    );

    const unit = screen.getByText("mg");
    expect(unit.textContent).toBe("mg");
    // An uppercasing transform on a dose unit changes its meaning.
    expect(unit.className).toContain("normal-case");
    expect(unit.className).not.toContain("uppercase");
  });

  it("flags a row whose cited source is overdue", () => {
    render(
      <DoseLine
        rows={[
          { id: "quetiapine", drug: "Quetiapine", dose: { value: "800", unit: "mg/day" }, status: "current" },
          {
            id: "olanzapine",
            drug: "Olanzapine",
            dose: { value: "20", unit: "mg/day" },
            status: "review_due",
            // An overdue row must carry the route back to its source: the type
            // refuses "warned, with nowhere to go".
            source: { sourceId: "doc-3", title: "Olanzapine Monograph" },
          },
        ]}
        onOpenSource={vi.fn()}
      />,
    );

    const rows = screen.getAllByTestId("dose-row");
    expect(rows[0]).not.toHaveAttribute("data-overdue");
    expect(rows[1]).toHaveAttribute("data-overdue", "true");
  });
});

describe("AnswerFooter", () => {
  // PR 6 reverses the old "drop unknown segments" behaviour: on a provenance
  // strip the absence IS the governance signal, so an unrecorded publisher now
  // says so instead of looking identical to a recorded one.
  it("names every provenance field, rendering absences as phrases", () => {
    render(<AnswerFooter publisher="RANZCP" generatedAt="2026-07-31T05:04:00.000Z" />);

    const footer = screen.getByTestId("answer-footer");
    expect(footer).toHaveTextContent("RANZCP");
    expect(footer).toHaveTextContent("Version");
    expect(footer).toHaveTextContent("Review");
    expect(within(footer).getAllByTestId("missing-value").length).toBeGreaterThan(0);
  });
});
