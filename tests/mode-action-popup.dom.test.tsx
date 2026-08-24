import { readFileSync } from "node:fs";
import path from "node:path";

import { useRef, useState } from "react";

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

function CustomBodyHarness() {
  const [open, setOpen] = useState(false);

  return (
    <ModeActionPopup
      open={open}
      title="Pins and search"
      titleIcon={Search}
      buttonLabel="Open pins and search"
      items={modeActionItemsFor("documents")}
      onOpenChange={setOpen}
      onAction={vi.fn()}
      customBody={
        <div>
          <button type="button">First custom action</button>
          <button type="button">Middle custom action</button>
          <button type="button">Last custom action</button>
        </div>
      }
    />
  );
}

function CustomBodySheetReturnFocusHarness() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <>
      <input ref={inputRef} aria-label="Search composer" />
      <ModeActionPopup
        open={open}
        title="Pins and search"
        titleIcon={Search}
        buttonLabel="Open pins and search"
        items={modeActionItemsFor("documents")}
        onOpenChange={setOpen}
        onAction={vi.fn()}
        useSheet
        sheetReturnFocusRef={returnFocusRef}
        onBeforeOpen={() => {
          returnFocusRef.current = null;
        }}
        customBody={
          <button
            type="button"
            onClick={() => {
              returnFocusRef.current = inputRef.current;
              setOpen(false);
            }}
          >
            Search current area
          </button>
        }
      />
    </>
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

    await user.click(screen.getByRole("menuitem", { name: "Browse library" }));
    expect(onAction).toHaveBeenCalledWith("documents-collections");
    expect(screen.queryByRole("menu", { name: "Documents" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens from the keyboard and moves focus through the action list", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Open document actions" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");

    const first = screen.getByRole("menuitem", { name: "Browse library" });
    await waitFor(() => expect(first).toHaveFocus());
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Open source PDF" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Documents" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("gives custom bodies dialog semantics and focuses the last custom control from ArrowUp", async () => {
    const user = userEvent.setup();
    render(<CustomBodyHarness />);

    const trigger = screen.getByRole("button", { name: "Open pins and search" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    trigger.focus();
    await user.keyboard("{ArrowUp}");

    const dialog = screen.getByRole("dialog", { name: "Pins and search" });
    expect(screen.getByTestId("daily-actions-menu")).toBe(dialog);
    await waitFor(() => expect(screen.getByRole("button", { name: "Last custom action" })).toHaveFocus());
  });

  it("keeps custom body placement measurement stable across parent renders", () => {
    // jsdom does not support `new URL(..., import.meta.url)` file resolution.
    const source = readFileSync(
      path.join(process.cwd(), "src/components/clinical-dashboard/mode-action-popup.tsx"),
      "utf8",
    );

    expect(source).toContain("const hasCustomBody = Boolean(customBody);");
    expect(source).toContain("[hasCustomBody, integrated, integratedChipRow, items.length]");
    expect(source).not.toContain("[customBody, integrated, integratedChipRow, items.length]");
  });

  it("lets custom sheet actions retarget return focus to the composer", async () => {
    const user = userEvent.setup();
    render(<CustomBodySheetReturnFocusHarness />);

    await user.click(screen.getByRole("button", { name: "Open pins and search" }));
    await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));
    await user.click(screen.getByRole("button", { name: "Search current area" }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Search composer" })).toHaveFocus());
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

  // Regression: PR #2211 restricted uploads to the administrator backend and removed the
  // `documents-upload` entry point. That left the indexing drawer unreachable from a cold
  // load — every `setIndexingAdminDrawerOpen(true)` call sits inside `openLibraryHealthTarget`,
  // and both `LibraryHealthStrip` render sites are behind the drawer already being open, so an
  // administrator had no first move to document management, setup, jobs or quality controls.
  it("offers administrators a document-management entry and hides it from everyone else", () => {
    const adminItems = modeActionItemsFor("documents", { canManageDocuments: true });
    const adminAction = adminItems.find((item) => item.id === "documents-admin");
    expect(adminAction, "administrators need a cold-load route to document management").toBeDefined();
    expect(adminAction?.label).toBe("Manage library");

    const clinicianItems = modeActionItemsFor("documents", { canManageDocuments: false });
    expect(clinicianItems.some((item) => item.id === "documents-admin")).toBe(false);

    // Defaulting to hidden is the load-bearing half: a caller that forgets the flag must
    // under-show rather than surface an admin affordance to a clinician.
    expect(modeActionItemsFor("documents").some((item) => item.id === "documents-admin")).toBe(false);

    // The non-admin rows are unaffected by the filter.
    expect(clinicianItems.map((item) => item.id)).toEqual(
      adminItems.filter((item) => item.id !== "documents-admin").map((item) => item.id),
    );
  });

  it("sends factsheets Browse all sheets to the Topics page, not Search", () => {
    const items = modeActionItemsFor("factsheets");
    expect(items.map((item) => [item.id, item.label])).toEqual([
      ["factsheets-search", "Search factsheets"],
      ["factsheets-browse", "Browse all sheets"],
    ]);

    const source = readFileSync(
      path.join(process.cwd(), "src/components/clinical-dashboard/master-search-header.tsx"),
      "utf8",
    );
    expect(source).toMatch(/if \(actionId === "factsheets-browse"\) \{\s*router\.push\("\/factsheets\/topics"\);/);
  });
});
