import { useState } from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Search, UploadCloud } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import {
  ModeActionPopup,
  modeActionItemsFor,
  type ModeActionModeOption,
} from "@/components/clinical-dashboard/mode-action-popup";

const modeOptions: ModeActionModeOption[] = [
  { id: "documents", label: "Documents", icon: Search },
  { id: "answer", label: "Answer", icon: Search },
  { id: "upload", label: "Upload", icon: UploadCloud, disabled: true },
];

function Harness({ onAction = vi.fn(), onModeSelect = vi.fn() }) {
  const [open, setOpen] = useState(false);

  return (
    <ModeActionPopup
      open={open}
      title="Documents"
      titleIcon={Search}
      buttonLabel="Open document actions"
      items={modeActionItemsFor("documents")}
      modeOptions={modeOptions}
      selectedModeId="documents"
      onOpenChange={setOpen}
      onAction={onAction}
      onModeSelect={onModeSelect}
    />
  );
}

describe("ModeActionPopup state transitions", () => {
  it("starts closed, opens its action menu, and closes after an action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Harness onAction={onAction} />);

    const trigger = screen.getByRole("button", { name: "Open document actions" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu", { name: "Documents" })).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Documents" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Upload PDF" }));
    expect(onAction).toHaveBeenCalledWith("documents-upload");
    expect(screen.queryByRole("menu", { name: "Documents" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens from the keyboard and moves focus through the action list", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Open document actions" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");

    const first = screen.getByRole("menuitem", { name: "Upload PDF" });
    await waitFor(() => expect(first).toHaveFocus());
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Open source PDF" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Documents" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("selects enabled modes and exposes disabled modes without selecting them", async () => {
    const user = userEvent.setup();
    const onModeSelect = vi.fn();
    render(<Harness onModeSelect={onModeSelect} />);

    await user.click(screen.getByRole("button", { name: "Open document actions" }));
    const modeTrigger = screen.getByRole("button", { name: "Documents" });
    await user.click(modeTrigger);

    expect(screen.getByRole("menu", { name: "Choose search mode" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Documents" })).toHaveAttribute("aria-checked", "true");
    const disabledMode = screen.getByRole("menuitemradio", { name: "Upload" });
    expect(disabledMode).toBeDisabled();
    await user.click(disabledMode);
    expect(onModeSelect).not.toHaveBeenCalled();

    await user.click(screen.getByRole("menuitemradio", { name: "Answer" }));
    expect(onModeSelect).toHaveBeenCalledWith("answer");
    expect(screen.queryByRole("menu", { name: "Choose search mode" })).not.toBeInTheDocument();
    await waitFor(() => expect(modeTrigger).toHaveFocus());
  });
});
