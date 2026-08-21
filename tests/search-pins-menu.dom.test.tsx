import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileText, Search } from "lucide-react";

import { SearchPinsMenu } from "@/components/clinical-dashboard/search-pins-menu";
import type { ModeActionItem, ModeActionModeOption } from "@/components/clinical-dashboard/mode-action-popup";
import {
  maximumSearchPins,
  resetSearchPinsSessionForTests,
  searchPinsChangeEvent,
  searchPinsStorageKey,
} from "@/lib/search-pins";

const modeOptions: ModeActionModeOption[] = [
  { id: "documents", label: "Documents", description: "Source documents", icon: FileText },
  { id: "answer", label: "Answer", description: "Source-backed answer", icon: Search },
];

const actions: ModeActionItem[] = [
  { id: "documents-search", label: "Search sources", icon: Search },
  { id: "documents-recent", label: "Recent documents", icon: FileText },
];

const longActionList: ModeActionItem[] = [
  { id: "documents-search", label: "Search sources", icon: Search },
  { id: "documents-collections", label: "Browse library", icon: FileText },
  { id: "documents-scope", label: "Scope sources", icon: FileText },
  { id: "documents-tables", label: "Tables", icon: FileText },
  { id: "documents-viewer", label: "Open source PDF", icon: FileText },
];

function renderMenu(overrides: Partial<ComponentProps<typeof SearchPinsMenu>> = {}) {
  const props: ComponentProps<typeof SearchPinsMenu> = {
    currentModeId: "documents",
    modeOptions,
    actions,
    onClose: vi.fn(),
    onCurrentSearch: vi.fn(),
    onGlobalSearch: vi.fn(),
    onModeSelect: vi.fn(),
    onAction: vi.fn(),
    ...overrides,
  };
  render(<SearchPinsMenu {...props} />);
  return props;
}

describe("SearchPinsMenu", () => {
  beforeEach(() => {
    resetSearchPinsSessionForTests();
    window.localStorage.removeItem(searchPinsStorageKey);
  });

  it("keeps pins, search choices, and actions as separate sections", () => {
    renderMenu();
    expect(screen.getByRole("heading", { name: "Your pins" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Search in" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Useful actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Ward essentials pin, 3 destinations" })).toHaveAttribute(
      "data-sheet-autofocus",
      "true",
    );
  });

  it("expands a pin into explicit destination links without changing search mode", async () => {
    const user = userEvent.setup();
    const onModeSelect = vi.fn();
    renderMenu({ onModeSelect });

    await user.click(screen.getByRole("button", { name: "Open Ward essentials pin, 3 destinations" }));
    expect(screen.getByRole("link", { name: "Documents" })).toHaveAttribute("href", "/documents");
    expect(screen.getByRole("link", { name: "Medications" })).toHaveAttribute("href", "/medications");
    expect(onModeSelect).not.toHaveBeenCalled();
  });

  it("creates and persists an editable pin", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "New pin" }));
    const name = screen.getByRole("textbox", { name: "Pin name" });
    await user.type(name, "My clinic");
    await user.click(screen.getByRole("button", { name: "Medications" }));
    await user.click(screen.getByRole("button", { name: "Create pin" }));

    expect(screen.getByText("My clinic")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(searchPinsStorageKey) ?? "[]")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "My clinic", destinationIds: ["documents", "prescribing"] }),
      ]),
    );
  });

  it("keeps same-window pin changes when browser storage is unavailable", () => {
    renderMenu();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(searchPinsChangeEvent, {
          detail: [{ id: "clinic", name: "My clinic", destinationIds: ["documents", "forms"] }],
        }),
      );
    });

    expect(screen.getByText("My clinic")).toBeInTheDocument();
  });

  it("re-reads storage when a pin-change event carries no payload", () => {
    window.localStorage.setItem(
      searchPinsStorageKey,
      JSON.stringify([{ id: "clinic", name: "Stored clinic", destinationIds: ["documents"] }]),
    );
    renderMenu();

    act(() => {
      window.dispatchEvent(new CustomEvent(searchPinsChangeEvent));
    });

    expect(screen.getByText("Stored clinic")).toBeInTheDocument();
    expect(screen.queryByText("Ward essentials")).not.toBeInTheDocument();
  });

  it("marks the first pin for sheet autofocus", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: "Open Ward essentials pin, 3 destinations" })).toHaveAttribute(
      "data-sheet-autofocus",
      "true",
    );
  });

  it("closes the pin editor on Escape without dismissing the surrounding menu", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderMenu({ onClose });

    await user.click(screen.getByRole("button", { name: "New pin" }));
    expect(screen.getByRole("heading", { name: "Create a new pin" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("heading", { name: "Your pins" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("requires a second click before deleting a pin", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Edit Ward essentials" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Confirm delete" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Edit pin" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.queryByText("Ward essentials")).not.toBeInTheDocument();
  });

  it("disables pin creation at the persisted limit instead of silently truncating", () => {
    window.localStorage.setItem(
      searchPinsStorageKey,
      JSON.stringify(
        Array.from({ length: maximumSearchPins }, (_, index) => ({
          id: `pin-${index}`,
          name: `Pin ${index + 1}`,
          destinationIds: ["documents"],
        })),
      ),
    );

    renderMenu();

    expect(screen.getByRole("button", { name: "New pin" })).toBeDisabled();
  });

  it("opens universal search and changes area only through explicit search controls", async () => {
    const user = userEvent.setup();
    const onGlobalSearch = vi.fn();
    const onModeSelect = vi.fn();
    renderMenu({ onGlobalSearch, onModeSelect });

    await user.click(screen.getByRole("button", { name: /Search all clinical areas/ }));
    expect(onGlobalSearch).toHaveBeenCalledOnce();
    expect(onModeSelect).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Choose another search area/ }));
    await user.click(screen.getByRole("button", { name: /Answer/ }));
    expect(onModeSelect).toHaveBeenCalledWith("answer");
  });

  it("omits the universal search action when the command dropdown is unavailable", () => {
    renderMenu({ globalSearchAvailable: false });

    expect(screen.queryByRole("button", { name: /Search all clinical areas/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose another search area/ })).toBeInTheDocument();
  });

  it("renders every supplied mode action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderMenu({ actions: longActionList, onAction });

    expect(screen.getByRole("menuitem", { name: "Search sources" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Tables" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Open source PDF" }));
    expect(onAction).toHaveBeenCalledWith("documents-viewer");
  });
});
