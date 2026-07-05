"use client";

import { AlertTriangle, Clock, CornerDownLeft, Search, X } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import {
  modeActionItemsFor,
  type ModeActionId,
  type ModeActionSetId,
} from "@/components/clinical-dashboard/mode-action-popup";
import { AnswerSuggestionChips } from "@/components/clinical-dashboard/answer-suggestion-chips";
import { cn } from "@/components/ui-primitives";
import { appModeDefinition, type AppModeId } from "@/lib/app-modes";
import { appModeIcons } from "@/lib/app-mode-icons";
import {
  differentialRedFlagTerms,
  filteredSuggestions,
  isFormCodeQuery,
  searchCommandSurfaceConfig,
} from "@/lib/search-command-surface";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

type DropdownItem = {
  id: string;
  label: string;
  onSelect: () => void;
  render: (active: boolean) => ReactNode;
};

function OptionShell({ active, children, hint }: { active: boolean; children: ReactNode; hint: string }) {
  return (
    <div
      className={cn(
        "grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2.5 py-1.5 transition",
        active ? "bg-[color:var(--clinical-accent-soft)]" : "hover:bg-[color:var(--surface-subtle)]",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">{children}</div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 text-2xs font-bold text-[color:var(--clinical-accent)]",
          active ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      >
        {hint}
        <CornerDownLeft className="h-3 w-3" />
      </span>
    </div>
  );
}

export type CommandSurfacePlacement = "bottom-dock" | "inline";

function ContextHintRow({
  examples,
  onPickExample,
  placement,
}: {
  modeId: AppModeId;
  examples: string[];
  onPickExample: (example: string) => void;
  placement: CommandSurfacePlacement;
}) {
  const visibilityClass = placement === "bottom-dock" ? "flex" : "hidden lg:flex";

  return (
    <AnswerSuggestionChips
      suggestions={examples}
      onPick={onPickExample}
      label="Examples"
      layout="scroll"
      className={visibilityClass}
    />
  );
}

function ScopeChipRow({
  scopes,
  activeScopes,
  onToggle,
  modeLabel,
}: {
  scopes: Array<{ id: string; label: string }>;
  activeScopes: string[];
  onToggle: (id: string) => void;
  modeLabel: string;
}) {
  if (!scopes.length) return null;

  return (
    <div
      className="hidden flex-wrap items-center justify-center gap-1.5 lg:flex"
      role="group"
      aria-label={`${modeLabel} search scope`}
    >
      {scopes.map((scope) => {
        const active = activeScopes.includes(scope.id);
        return (
          <button
            key={scope.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(scope.id)}
            className={cn(
              "answer-footer-search-chip",
              focusRing,
              active &&
                "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
            )}
          >
            {active ? <X className="h-3.5 w-3.5" aria-hidden /> : null}
            {scope.label}
          </button>
        );
      })}
    </div>
  );
}

function CommandDropdown({
  modeId,
  query,
  listboxId,
  activeItemId,
  sections,
  showSafetyBanner,
  onHoverItem,
  placement,
}: {
  modeId: AppModeId;
  query: string;
  listboxId: string;
  activeItemId: string | null;
  sections: Array<{ key: string; heading?: string; layout?: "list" | "chips"; items: DropdownItem[] }>;
  showSafetyBanner: boolean;
  onHoverItem: (id: string) => void;
  placement: CommandSurfacePlacement;
}) {
  const mode = appModeDefinition(modeId);
  const hasItems = sections.some((section) => section.items.length > 0);
  const opensUpward = placement === "bottom-dock";

  return (
    <div
      className={cn(
        "universal-command-dropdown absolute left-0 right-0 z-30 overflow-hidden rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface)] shadow-[0_8px_20px_rgb(16_24_40_/_9%),0_24px_56px_rgb(16_24_40_/_14%)]",
        opensUpward ? "bottom-[calc(100%+0.5rem)] top-auto" : "top-[calc(100%+0.5rem)]",
        placement === "bottom-dock" ? "block" : "hidden lg:block",
      )}
      role="presentation"
    >
      {showSafetyBanner ? (
        <div className="flex items-start gap-2.5 border-b border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--danger)]" aria-hidden />
          <div className="min-w-0 text-xs font-semibold leading-5 text-[color:var(--text)]">
            <span className="font-extrabold uppercase tracking-wide text-[color:var(--danger)]">Safety first · </span>
            Stabilise ABCs, check BGL, sats, attention test, collateral, review meds/substances.
          </div>
        </div>
      ) : null}

      <div
        id={listboxId}
        role="listbox"
        aria-label={`${mode.label} search suggestions`}
        className={cn("overflow-y-auto p-2", opensUpward ? "max-h-[min(38dvh,20rem)]" : "max-h-[26rem]")}
      >
        {sections.map((section) =>
          section.items.length ? (
            <div key={section.key} className="pb-1 last:pb-0">
              {section.heading ? (
                <div
                  role="presentation"
                  className="px-2.5 pb-1 pt-2 text-2xs font-extrabold uppercase tracking-[0.06em] text-[color:var(--text-soft)]"
                >
                  {section.heading}
                </div>
              ) : null}
              {section.layout === "chips" ? (
                <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5">
                  {query ? (
                    <span className="text-xs font-semibold text-[color:var(--text-muted)]">
                      Search &ldquo;{query}&rdquo; in
                    </span>
                  ) : null}
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      id={item.id}
                      role="option"
                      aria-selected={activeItemId === item.id}
                      onMouseEnter={() => onHoverItem(item.id)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        item.onSelect();
                      }}
                      className="cursor-pointer"
                    >
                      {item.render(activeItemId === item.id)}
                    </div>
                  ))}
                </div>
              ) : (
                section.items.map((item) => (
                  <div
                    key={item.id}
                    id={item.id}
                    role="option"
                    aria-selected={activeItemId === item.id}
                    onMouseEnter={() => onHoverItem(item.id)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      item.onSelect();
                    }}
                    className="cursor-pointer"
                  >
                    {item.render(activeItemId === item.id)}
                  </div>
                ))
              )}
            </div>
          ) : null,
        )}
        {!hasItems ? (
          <div className="px-3 py-4 text-sm font-semibold text-[color:var(--text-muted)]">
            Press Enter to run the full {mode.label.toLowerCase()} search.
          </div>
        ) : null}
      </div>

      <div className="hidden items-center justify-between border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-2 text-2xs font-bold text-[color:var(--text-soft)] sm:flex">
        <span className="inline-flex items-center gap-2">
          <kbd className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-1 font-mono">↑↓</kbd>
          navigate
          <kbd className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-1 font-mono">↵</kbd>
          open / search
        </span>
        <span>Enter with nothing highlighted runs the full search</span>
      </div>
    </div>
  );
}

export function UniversalSearchCommandSurface({
  modeId,
  query,
  recentQueries,
  commandScopes,
  dropdownOpen,
  onDropdownOpenChange,
  onQueryChange,
  onSearch,
  onPickRecent,
  onCrossMode,
  onRunModeAction,
  onCommandScopesChange,
  onInputKeyDown,
  onFocusSearchInput,
  onListboxIdReady,
  placement = "inline",
  requiresTypedQueryToOpen = false,
  children,
}: {
  modeId: AppModeId;
  query: string;
  recentQueries: string[];
  commandScopes: string[];
  dropdownOpen: boolean;
  onDropdownOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onPickRecent: (query: string) => void;
  onCrossMode: (modeId: AppModeId, query: string) => void;
  onRunModeAction?: (actionId: ModeActionId) => void;
  onCommandScopesChange: (scopes: string[]) => void;
  onInputKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onFocusSearchInput?: () => void;
  onListboxIdReady?: (listboxId: string) => void;
  placement?: CommandSurfacePlacement;
  requiresTypedQueryToOpen?: boolean;
  children: ReactNode;
}) {
  const config = searchCommandSurfaceConfig(modeId);
  const listboxId = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const trimmedQuery = query.trim();
  const composerFocusedRef = useRef(false);
  const mode = appModeDefinition(modeId);

  function canOpenDropdownNow() {
    return !requiresTypedQueryToOpen || trimmedQuery.length > 0;
  }

  const showSafetyBanner =
    modeId === "differentials" && differentialRedFlagTerms.some((term) => trimmedQuery.toLowerCase().includes(term));
  const showFormCodeHint = modeId === "forms" && isFormCodeQuery(trimmedQuery);

  const sections = useMemo(() => {
    if (!config) return [];
    const built: Array<{ key: string; heading?: string; layout?: "list" | "chips"; items: DropdownItem[] }> = [];
    let counter = 0;
    const nextId = () => `${listboxId}-item-${counter++}`;

    if (showFormCodeHint) {
      built.push({
        key: "form-code",
        heading: "Form code match",
        items: [
          {
            id: nextId(),
            label: `Form ${trimmedQuery.replace(/^form\s+/i, "")}`,
            onSelect: onSearch,
            render: (active) => (
              <OptionShell active={active} hint="Search">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-sm font-black text-[color:var(--clinical-accent)]">
                  {trimmedQuery.replace(/^form\s+/i, "").toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-[color:var(--text-heading)]">
                    Form {trimmedQuery.replace(/^form\s+/i, "").toUpperCase()}
                  </span>
                  <span className="block truncate text-xs font-medium text-[color:var(--text-muted)]">
                    Press Enter to search forms
                  </span>
                </span>
              </OptionShell>
            ),
          },
        ],
      });
    }

    if (!trimmedQuery) {
      const recents = recentQueries.slice(0, 5);
      if (recents.length) {
        built.push({
          key: "recents",
          heading: `Recent in ${mode.label}`,
          items: recents.map((recent) => ({
            id: nextId(),
            label: recent,
            onSelect: () => {
              onDropdownOpenChange(false);
              onPickRecent(recent);
            },
            render: (active) => (
              <OptionShell active={active} hint="Search">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]">
                  <Clock className="h-4 w-4" />
                </span>
                <span className="truncate text-sm font-semibold text-[color:var(--text)]">{recent}</span>
              </OptionShell>
            ),
          })),
        });
      } else if (modeId === "answer" && config.examples.length) {
        built.push({
          key: "examples",
          heading: "Examples",
          layout: "chips",
          items: config.examples.map((example) => ({
            id: nextId(),
            label: example,
            onSelect: () => {
              onDropdownOpenChange(false);
              onQueryChange(example);
              onFocusSearchInput?.();
            },
            render: (active) => (
              <span
                className={cn(
                  "answer-suggestion-chip",
                  active &&
                    "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
                )}
              >
                {example}
              </span>
            ),
          })),
        });
      }
    } else {
      const suggestions = filteredSuggestions(config, trimmedQuery);
      if (suggestions.length) {
        built.push({
          key: "suggestions",
          heading: "Suggestions",
          items: suggestions.map((suggestion) => ({
            id: nextId(),
            label: suggestion.text,
            onSelect: () => {
              onDropdownOpenChange(false);
              onQueryChange(suggestion.text);
              onSearch();
            },
            render: (active) => (
              <OptionShell active={active} hint="Search">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]">
                  <Search className="h-4 w-4" />
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-[color:var(--text)]">
                  {suggestion.text}
                </span>
                <span className="inline-flex min-h-6 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 text-2xs font-bold text-[color:var(--text-muted)]">
                  {suggestion.meta}
                </span>
              </OptionShell>
            ),
          })),
        });
      }
    }

    const actionSetId: ModeActionSetId | null =
      modeId === "documents" || modeId === "forms" || modeId === "prescribing"
        ? "documents"
        : modeId === "services"
          ? "services"
          : modeId === "favourites"
            ? "favourites"
            : modeId === "differentials"
              ? "differentials"
              : modeId === "answer"
                ? "answer"
                : modeId === "tools"
                  ? "tools"
                  : null;

    if (actionSetId) {
      const actions = modeActionItemsFor(actionSetId).slice(0, 3);
      if (actions.length) {
        built.push({
          key: "actions",
          heading: `${mode.label} actions`,
          items: actions.map((action) => ({
            id: nextId(),
            label: action.label,
            onSelect: () => {
              onDropdownOpenChange(false);
              onRunModeAction?.(action.id);
            },
            render: (active) => (
              <OptionShell active={active} hint="Run">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="truncate text-sm font-semibold text-[color:var(--text)]">{action.label}</span>
                <span className="inline-flex min-h-6 items-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-1.5 text-2xs font-bold text-[color:var(--text-muted)]">
                  {action.shortLabel ?? action.description}
                </span>
              </OptionShell>
            ),
          })),
        });
      }
    }

    if (trimmedQuery && config.crossModes.length) {
      built.push({
        key: "cross-mode",
        layout: "chips",
        items: config.crossModes.map((target) => {
          const targetMode = appModeDefinition(target);
          const TargetIcon = appModeIcons[target];
          return {
            id: nextId(),
            label: targetMode.label,
            onSelect: () => {
              onDropdownOpenChange(false);
              onCrossMode(target, trimmedQuery);
            },
            render: (active) => (
              <span
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold transition",
                  active
                    ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]",
                )}
              >
                <TargetIcon className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" aria-hidden />
                {targetMode.label}
              </span>
            ),
          };
        }),
      });
    }

    return built;
  }, [
    config,
    listboxId,
    mode,
    modeId,
    onCrossMode,
    onDropdownOpenChange,
    onFocusSearchInput,
    onPickRecent,
    onQueryChange,
    onRunModeAction,
    onSearch,
    recentQueries,
    showFormCodeHint,
    trimmedQuery,
  ]);

  const flatItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const activeItemId = activeIndex >= 0 && activeIndex < flatItems.length ? flatItems[activeIndex].id : null;

  function toggleScope(id: string) {
    onCommandScopesChange(
      commandScopes.includes(id) ? commandScopes.filter((scope) => scope !== id) : [...commandScopes, id],
    );
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!canOpenDropdownNow()) return;
      onDropdownOpenChange(true);
      setActiveIndex((current) => (current + 1) % Math.max(flatItems.length, 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!canOpenDropdownNow()) return;
      onDropdownOpenChange(true);
      setActiveIndex((current) => (current <= 0 ? flatItems.length - 1 : current - 1));
      return;
    }
    if (event.key === "Home" && dropdownOpen && flatItems.length) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && dropdownOpen && flatItems.length) {
      event.preventDefault();
      setActiveIndex(flatItems.length - 1);
      return;
    }
    if (event.key === "Escape") {
      onDropdownOpenChange(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "Enter" && dropdownOpen && activeIndex >= 0 && flatItems[activeIndex]) {
      event.preventDefault();
      flatItems[activeIndex].onSelect();
      return;
    }
    onInputKeyDown?.(event);
  }

  useEffect(() => {
    onListboxIdReady?.(listboxId);
  }, [listboxId, onListboxIdReady]);

  useEffect(() => {
    if (requiresTypedQueryToOpen && composerFocusedRef.current && trimmedQuery.length > 0) {
      onDropdownOpenChange(true);
    }
    if (requiresTypedQueryToOpen && trimmedQuery.length === 0) {
      onDropdownOpenChange(false);
      setActiveIndex(-1);
    }
  }, [requiresTypedQueryToOpen, trimmedQuery, onDropdownOpenChange]);

  useEffect(() => {
    function handleSlashFocus(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      onFocusSearchInput?.();
    }
    window.addEventListener("keydown", handleSlashFocus);
    return () => window.removeEventListener("keydown", handleSlashFocus);
  }, [onFocusSearchInput]);

  if (!config) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn(
        "universal-command-surface relative z-10 flex w-full flex-col",
        placement === "bottom-dock" ? "gap-1" : "gap-2",
      )}
    >
      <ContextHintRow
        modeId={modeId}
        examples={config.examples}
        placement={placement}
        onPickExample={(example) => {
          onQueryChange(example);
          onDropdownOpenChange(true);
          onFocusSearchInput?.();
        }}
      />
      <div
        className="relative w-full"
        onKeyDownCapture={(event) => {
          if (event.target instanceof HTMLInputElement && event.target.dataset.testid === "global-search-input") {
            handleComposerKeyDown(event as unknown as ReactKeyboardEvent<HTMLInputElement>);
          }
        }}
        onFocusCapture={() => {
          composerFocusedRef.current = true;
          if (canOpenDropdownNow()) {
            onDropdownOpenChange(true);
          }
        }}
        onBlurCapture={(event) => {
          composerFocusedRef.current = false;
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            onDropdownOpenChange(false);
            setActiveIndex(-1);
          }
        }}
      >
        {children}
        {dropdownOpen ? (
          <CommandDropdown
            modeId={modeId}
            query={trimmedQuery}
            listboxId={listboxId}
            activeItemId={activeItemId}
            sections={sections}
            showSafetyBanner={showSafetyBanner}
            placement={placement}
            onHoverItem={(id) => {
              const index = flatItems.findIndex((item) => item.id === id);
              if (index >= 0) setActiveIndex(index);
            }}
          />
        ) : null}
      </div>
      <ScopeChipRow scopes={config.scopes} activeScopes={commandScopes} onToggle={toggleScope} modeLabel={mode.label} />
      <style>{`@keyframes universal-command-fade { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
