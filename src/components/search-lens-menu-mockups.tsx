"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CirclePlus,
  Clock3,
  Command,
  FileText,
  Globe2,
  Heart,
  Layers3,
  MessageSquarePlus,
  Pill,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";

import { cn } from "@/components/ui-primitives";

type DirectionId = "lens-fold" | "command-deck" | "inline-builder";
type DomainId = "documents" | "medications" | "services" | "forms" | "differentials" | "tools";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const directionMeta: Record<
  DirectionId,
  { label: string; shortLabel: string; strapline: string; verdict: string; bestFor: string; icon: LucideIcon }
> = {
  "lens-fold": {
    label: "Attached pin fold-out",
    shortLabel: "Pin fold-out",
    strapline: "A calm layer for user pins and deliberate search-area choices.",
    verdict: "Recommended",
    bestFor: "Clarity and gradual adoption",
    icon: Layers3,
  },
  "command-deck": {
    label: "Pins and search command deck",
    shortLabel: "Pins + search deck",
    strapline: "One powerful workspace for opening pins, choosing search areas, and acting on results.",
    verdict: "Powerful",
    bestFor: "Frequent expert use",
    icon: Command,
  },
  "inline-builder": {
    label: "Inline pin bar",
    shortLabel: "Inline pin bar",
    strapline: "A personal pin stays visible above the composer while search scope remains stable.",
    verdict: "Expressive",
    bestFor: "Fast custom combinations",
    icon: SlidersHorizontal,
  },
};

const domainMeta: Record<DomainId, { label: string; shortLabel: string; icon: LucideIcon; tone: string }> = {
  documents: {
    label: "Documents",
    shortLabel: "Documents",
    icon: FileText,
    tone: "bg-[#eaf3fb] text-[#145b94] border-[#bfd8ec]",
  },
  medications: {
    label: "Medications",
    shortLabel: "Medications",
    icon: Pill,
    tone: "bg-[#eef7f3] text-[#21694f] border-[#c7e3d6]",
  },
  services: {
    label: "Services",
    shortLabel: "Services",
    icon: ShieldCheck,
    tone: "bg-[#f4f0fb] text-[#65479a] border-[#dbcfef]",
  },
  forms: {
    label: "Forms",
    shortLabel: "Forms",
    icon: BookOpen,
    tone: "bg-[#fff5e8] text-[#865819] border-[#ead6b7]",
  },
  differentials: {
    label: "Differentials",
    shortLabel: "Differentials",
    icon: Sparkles,
    tone: "bg-[#fdf0f3] text-[#98445c] border-[#ecc9d3]",
  },
  tools: {
    label: "Clinical tools",
    shortLabel: "Tools",
    icon: Wrench,
    tone: "bg-[#f0f2f5] text-[#4a5663] border-[#d5dbe2]",
  },
};

const domainOrder = Object.keys(domainMeta) as DomainId[];

const lenses = [
  {
    id: "documents",
    kind: "search",
    label: "Search Documents",
    detail: "Current mode",
    domains: ["documents"] as DomainId[],
    icon: FileText,
  },
  {
    id: "everywhere",
    kind: "search",
    label: "Search all clinical areas",
    detail: "All 6 search areas",
    domains: domainOrder,
    icon: Globe2,
  },
  {
    id: "choose-area",
    kind: "search",
    label: "Choose another search area",
    detail: "Medications, services, tools…",
    domains: ["medications", "services", "tools"] as DomainId[],
    icon: Plus,
  },
  {
    id: "ward-round",
    kind: "pin",
    label: "Ward essentials",
    detail: "Your editable pin",
    domains: ["documents", "medications", "forms"] as DomainId[],
    icon: Heart,
  },
  {
    id: "quick-tools",
    kind: "pin",
    label: "My quick tools",
    detail: "Calculators, services, differentials",
    domains: ["tools", "services", "differentials"] as DomainId[],
    icon: Wrench,
  },
];

const actions = [
  { label: "Scope sources", detail: "Limit answer evidence", icon: SlidersHorizontal },
  { label: "Recent documents", detail: "Continue reading", icon: Clock3 },
  { label: "Browse library", detail: "Open all sources", icon: BookOpen },
];

function DomainIconRail({
  domains,
  compact = false,
  ariaLabel,
}: {
  domains: DomainId[];
  compact?: boolean;
  ariaLabel?: string;
}) {
  const shown = domains.slice(0, compact ? 3 : 4);
  const domainLabels = domains.map((domain) => domainMeta[domain].label).join(", ");
  return (
    <span
      className="inline-flex items-center"
      role="img"
      aria-label={ariaLabel ?? `Search areas: ${domainLabels}`}
      title={domainLabels}
    >
      {shown.map((domain, index) => {
        const Icon = domainMeta[domain].icon;
        return (
          <span
            key={domain}
            className={cn(
              "grid shrink-0 place-items-center rounded-full border-2 border-[color:var(--surface)] shadow-sm",
              compact ? "-ml-1 h-6 w-6 first:ml-0" : "-ml-1.5 h-8 w-8 first:ml-0",
              domainMeta[domain].tone,
            )}
            style={{ zIndex: shown.length - index }}
            aria-hidden="true"
          >
            <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </span>
        );
      })}
      {domains.length > shown.length ? (
        <span
          className={cn(
            "ml-1 inline-flex shrink-0 items-center justify-center rounded-full border border-[#c8d6e2] bg-[#eef4f9] font-extrabold text-[#315b7d] shadow-sm",
            compact ? "h-6 px-1.5 text-3xs" : "h-8 px-2 text-3xs",
          )}
          aria-hidden="true"
        >
          +{domains.length - shown.length} more
        </span>
      ) : null}
    </span>
  );
}

function DomainCountBadge({ domains, noun = "areas" }: { domains: DomainId[]; noun?: string }) {
  const domainLabels = domains.map((domain) => domainMeta[domain].label).join(", ");
  return (
    <span
      className="shrink-0 rounded-full border border-[#c8d6e2] bg-[#eef4f9] px-2 py-1 text-3xs font-extrabold text-[#315b7d]"
      title={domainLabels}
    >
      {domains.length} {domains.length === 1 ? noun.replace(/s$/, "") : noun}
    </span>
  );
}

function AppFrame({ phone, children }: { phone: boolean; children: ReactNode }) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden border border-[color:var(--border)] bg-[#f1f4f8] shadow-[0_22px_70px_rgba(31,48,66,0.13)]",
        phone ? "mx-auto h-[760px] w-full max-w-[390px] rounded-[2rem]" : "h-[760px] min-w-0 rounded-[1.5rem]",
      )}
      aria-label={phone ? "Phone preview" : "Desktop preview"}
    >
      <div
        className={cn(
          "flex h-[72px] items-center border-b border-[#e3e8ef] bg-[rgba(252,253,254,0.96)] px-4",
          phone ? "justify-between" : "justify-center",
        )}
      >
        {phone ? (
          <button
            type="button"
            className={cn("grid min-h-12 min-w-12 place-items-center rounded-xl", focusRing)}
            aria-label="Open navigation"
          >
            <span className="space-y-1" aria-hidden="true">
              <span className="block h-px w-4 bg-[#33404d]" />
              <span className="block h-px w-4 bg-[#33404d]" />
              <span className="block h-px w-4 bg-[#33404d]" />
            </span>
          </button>
        ) : (
          <span className="absolute left-5 grid h-9 w-9 place-items-center rounded-xl bg-[#1d6fb8] text-white shadow-sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <button
          type="button"
          className={cn(
            "inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[#d7e0e9] bg-white px-3 text-left shadow-sm",
            focusRing,
          )}
          aria-label="Mode Documents"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1d6fb8] text-white">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>
            {!phone ? (
              <span className="block text-3xs font-extrabold uppercase tracking-[0.1em] text-[#667586]">Mode</span>
            ) : null}
            <span className="block text-sm font-extrabold text-[#080b0f]">Documents</span>
          </span>
          <ChevronDown className="h-4 w-4 text-[#6b7785]" aria-hidden="true" />
        </button>
        {phone ? (
          <button
            type="button"
            className={cn("grid min-h-12 min-w-12 place-items-center rounded-xl", focusRing)}
            aria-label="Start a new chat"
          >
            <MessageSquarePlus className="h-5 w-5 text-[#33404d]" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "absolute right-5 inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#d7e0e9] bg-white px-4 text-sm font-bold text-[#33404d]",
              focusRing,
            )}
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            New chat
          </button>
        )}
      </div>
      <div className="relative h-[calc(100%_-_72px)]">{children}</div>
    </section>
  );
}

function Composer({
  phone,
  open,
  label,
  domains,
  onToggle,
  onInputIntent,
  toggleButtonRef,
}: {
  phone: boolean;
  open: boolean;
  label: string;
  domains: DomainId[];
  onToggle: () => void;
  onInputIntent?: () => void;
  toggleButtonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [query, setQuery] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
  }

  return (
    <div className="w-full">
      {!phone || !open ? (
        <div className="mb-2 flex min-h-7 items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border border-[#cbd8e5] bg-[rgba(252,253,254,0.92)] px-2.5 text-xs font-extrabold text-[#1c4f78] shadow-sm backdrop-blur",
              focusRing,
            )}
            aria-expanded={open}
          >
            <DomainIconRail domains={domains} compact />
            <span className="truncate">{label}</span>
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition motion-reduce:transition-none", open && "rotate-180")}
              aria-hidden="true"
            />
          </button>
          {!phone ? <span className="text-3xs font-bold text-[#778595]">Enter searches this lens</span> : null}
        </div>
      ) : null}
      <form
        role="search"
        aria-label={`${label} search preview`}
        onSubmit={submit}
        className="flex min-h-14 items-center rounded-[1.3rem] border border-[#b9c9d8] bg-[rgba(252,253,254,0.98)] p-1.5 shadow-[0_12px_30px_rgba(31,55,79,0.13)] ring-1 ring-white"
      >
        <button
          ref={toggleButtonRef}
          type="button"
          onClick={onToggle}
          aria-label={open ? "Close search options" : "Open search options"}
          aria-expanded={open}
          className={cn(
            "grid min-h-12 min-w-12 place-items-center rounded-2xl text-[#31516c] transition hover:bg-[#eff5fc] motion-reduce:transition-none",
            open && "bg-[#1d6fb8] text-white hover:bg-[#1d6fb8]",
            focusRing,
          )}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
        </button>
        <label className="min-w-0 flex-1 px-2">
          <span className="sr-only">Search {label}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onPointerDown={onInputIntent}
            placeholder={phone ? "Search clinical guidance…" : "Search documents, medication guidance, services…"}
            className="h-12 w-full min-w-0 bg-transparent text-sm font-semibold text-[#111820] outline-none placeholder:text-[#7b8794]"
          />
        </label>
        <button
          type="submit"
          aria-label={`Search ${label}`}
          className={cn(
            "grid min-h-12 min-w-12 place-items-center rounded-2xl bg-[#1d6fb8] text-white shadow-[0_8px_18px_rgba(29,111,184,0.22)]",
            focusRing,
          )}
        >
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

function LensFoldPanel({
  phone,
  selectedLens,
  onSelectLens,
  wardRoundDomains,
  onWardRoundDomainsChange,
  onClose,
  focusOnMount,
}: {
  phone: boolean;
  selectedLens: string;
  onSelectLens: (lensId: string) => void;
  wardRoundDomains: DomainId[];
  onWardRoundDomainsChange: (domains: DomainId[]) => void;
  onClose: () => void;
  focusOnMount: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState("ward-round");
  const [wardPinName, setWardPinName] = useState("Ward essentials");
  const [newPinName, setNewPinName] = useState("My new pin");
  const [newPinDomains, setNewPinDomains] = useState<DomainId[]>(["documents"]);
  const [createdPin, setCreatedPin] = useState<{
    id: string;
    kind: string;
    label: string;
    detail: string;
    domains: DomainId[];
    icon: LucideIcon;
  } | null>(null);

  const editorDomains = creating ? newPinDomains : wardRoundDomains;
  const pinOptions = [
    ...lenses
      .filter((item) => item.kind === "pin")
      .map((item) => (item.id === "ward-round" ? { ...item, label: wardPinName, domains: wardRoundDomains } : item)),
    ...(createdPin ? [createdPin] : []),
  ];

  function toggleDomain(domain: DomainId) {
    const current = creating ? newPinDomains : wardRoundDomains;
    const next = current.includes(domain)
      ? current.length === 1
        ? current
        : current.filter((item) => item !== domain)
      : [...current, domain];
    if (creating) setNewPinDomains(next);
    else onWardRoundDomainsChange(next);
  }

  function closeEditor() {
    setEditing(false);
    setCreating(false);
  }

  function saveEditor() {
    if (creating) {
      const pin = {
        id: "created-pin",
        kind: "pin",
        label: newPinName.trim() || "My new pin",
        detail: "Your new pin",
        domains: newPinDomains,
        icon: Heart,
      };
      setCreatedPin(pin);
      setSelectedPinId(pin.id);
    }
    closeEditor();
  }

  const body = (
    <div
      role="dialog"
      aria-label={editing ? (creating ? "Create a new pin" : "Edit Ward essentials pin") : "Pins and search"}
      aria-modal={phone || undefined}
      className={cn(
        "overflow-hidden border border-[#c7d4e0] bg-[rgba(252,253,254,0.98)] shadow-[0_24px_65px_rgba(23,45,66,0.2)] backdrop-blur-xl",
        phone ? "rounded-t-[1.6rem]" : "rounded-[1.35rem]",
      )}
    >
      <div className="flex items-start justify-between border-b border-[#e3e8ef] px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#eaf3fb] text-[#1d6fb8]">
              <Layers3 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-black text-[#080b0f]">
                {editing ? (creating ? "Create a new pin" : `Edit ${wardPinName}`) : "Pins and search"}
              </h3>
              <p className="text-2xs font-semibold text-[#6b7785]">
                {editing
                  ? "Choose useful destinations from across the app."
                  : "Open a pin or choose where this search runs."}
              </p>
            </div>
          </div>
        </div>
        <button
          autoFocus={focusOnMount}
          type="button"
          onClick={editing ? closeEditor : onClose}
          className={cn(
            "grid min-h-12 min-w-12 place-items-center rounded-xl text-[#536171] hover:bg-[#f0f3f6]",
            focusRing,
          )}
          aria-label={editing ? "Close pin editor" : "Close pins and search"}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {editing ? (
        <div className="p-3">
          <label className="mb-3 block px-1 text-3xs font-black uppercase tracking-[0.1em] text-[#6f7c89]">
            Pin name
            <input
              value={creating ? newPinName : wardPinName}
              onChange={(event) => (creating ? setNewPinName(event.target.value) : setWardPinName(event.target.value))}
              className="mt-1 h-12 w-full rounded-xl border border-[#cbd4dd] bg-white px-3 text-base font-bold normal-case tracking-normal text-[#17212b] outline-none focus:border-[#1d6fb8]"
            />
          </label>
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-3xs font-black uppercase tracking-[0.1em] text-[#6f7c89]">App destinations</span>
            <span className="text-2xs font-bold text-[#677584]" aria-live="polite">
              {editorDomains.length} destinations selected
            </span>
          </div>
          <div className="space-y-1.5">
            {domainOrder.map((domain) => {
              const meta = domainMeta[domain];
              const Icon = meta.icon;
              const active = editorDomains.includes(domain);
              return (
                <button
                  key={domain}
                  type="button"
                  onClick={() => toggleDomain(domain)}
                  aria-pressed={active}
                  aria-label={`${active ? "Remove" : "Add"} ${meta.label}`}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left transition motion-reduce:transition-none",
                    active ? "border-[#9fc4e3] bg-[#eff5fc]" : "border-transparent hover:bg-[#f4f6f8]",
                    focusRing,
                  )}
                >
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg border", meta.tone)}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="flex-1 text-sm font-bold text-[#17212b]">{meta.label}</span>
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full border",
                      active ? "border-[#1d6fb8] bg-[#1d6fb8] text-white" : "border-[#cbd4dd] text-transparent",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2 border-t border-[#e3e8ef] pt-3">
            <button
              type="button"
              onClick={closeEditor}
              className={cn(
                "min-h-12 flex-1 rounded-xl border border-[#cbd4dd] bg-white px-4 text-sm font-bold text-[#425160]",
                focusRing,
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEditor}
              className={cn(
                "min-h-12 flex-1 rounded-xl bg-[#1d6fb8] px-4 text-sm font-extrabold text-white",
                focusRing,
              )}
            >
              {creating ? "Create pin" : "Save pin"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="p-2.5">
            <div className="mb-1 flex items-center justify-between px-2">
              <h3 className="text-3xs font-black uppercase tracking-[0.1em] text-[#6f7c89]">Your pins</h3>
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setEditing(true);
                }}
                className={cn("min-h-10 rounded-lg px-2 text-3xs font-black text-[#1d6fb8]", focusRing)}
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                New pin
              </button>
            </div>
            {pinOptions.map((lens) => {
              const Icon = lens.icon;
              const active = lens.id === selectedPinId;
              const pinDomains = lens.domains;
              return (
                <div
                  key={lens.id}
                  className={cn(
                    "group flex min-h-[58px] w-full items-center rounded-xl transition motion-reduce:transition-none",
                    active ? "bg-[#eff5fc]" : "hover:bg-[#f4f6f8]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPinId(lens.id)}
                    className={cn(
                      "flex min-h-[58px] min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 text-left",
                      focusRing,
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-xl border",
                        active
                          ? "border-[#a9cbe7] bg-white text-[#1d6fb8]"
                          : "border-[#e0e5eb] bg-[#f7f9fb] text-[#647282]",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold text-[#17212b]">{lens.label}</span>
                      <span className="block truncate text-2xs font-semibold text-[#6f7c89]">
                        {lens.id === "ward-round"
                          ? phone
                            ? `${wardRoundDomains.length} destinations · editable`
                            : wardRoundDomains.map((domain) => domainMeta[domain].shortLabel).join(" + ")
                          : lens.detail}
                      </span>
                    </span>
                    <DomainIconRail
                      domains={pinDomains}
                      compact
                      ariaLabel={`${lens.label} contains app destinations: ${pinDomains
                        .map((domain) => domainMeta[domain].label)
                        .join(", ")}`}
                    />
                  </button>
                  {lens.id === "ward-round" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setEditing(true);
                      }}
                      aria-label="Edit Ward essentials"
                      className={cn(
                        "mr-2 min-h-12 rounded-lg px-2 text-3xs font-black text-[#1d6fb8] hover:bg-white",
                        focusRing,
                      )}
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
              );
            })}
            <div className="my-2 border-t border-[#e3e8ef] pt-2">
              <h3 className="px-2 pb-1 text-3xs font-black uppercase tracking-[0.1em] text-[#6f7c89]">Search in</h3>
              {lenses
                .filter((item) => item.kind === "search")
                .map((lens) => {
                  const Icon = lens.icon;
                  const active = lens.id === selectedLens;
                  return (
                    <button
                      key={lens.id}
                      type="button"
                      onClick={() => onSelectLens(lens.id)}
                      className={cn(
                        "flex min-h-[54px] w-full items-center gap-3 rounded-xl px-2.5 text-left transition motion-reduce:transition-none",
                        active ? "bg-[#eff5fc]" : "hover:bg-[#f4f6f8]",
                        focusRing,
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-9 w-9 place-items-center rounded-xl border",
                          active
                            ? "border-[#a9cbe7] bg-white text-[#1d6fb8]"
                            : "border-[#e0e5eb] bg-[#f7f9fb] text-[#647282]",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold text-[#17212b]">{lens.label}</span>
                        <span className="block truncate text-2xs font-semibold text-[#6f7c89]">{lens.detail}</span>
                      </span>
                      {active ? <Check className="h-4 w-4 shrink-0 text-[#1d6fb8]" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
            </div>
          </div>
          <div className="border-t border-[#e3e8ef] bg-[#f8fafc] p-3">
            <p className="mb-2 px-1 text-3xs font-black uppercase tracking-[0.1em] text-[#6f7c89]">Useful actions</p>
            <div className="grid grid-cols-2 gap-1.5">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-xl px-2.5 text-left hover:bg-white",
                    focusRing,
                  )}
                >
                  <action.icon className="h-4 w-4 shrink-0 text-[#1d6fb8]" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-xs font-extrabold text-[#26323e]">{action.label}</span>
                    {!phone ? (
                      <span className="block truncate text-3xs font-semibold text-[#788493]">{action.detail}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (phone) {
    return (
      <div
        data-testid="phone-lens-sheet-layer"
        className="absolute inset-x-0 top-0 bottom-[114px] z-30 flex items-end bg-[rgba(7,17,27,0.36)] pt-8 backdrop-blur-[1px]"
      >
        <div className="max-h-full w-full overflow-y-auto overscroll-contain">{body}</div>
      </div>
    );
  }

  return <div className="absolute bottom-[82px] left-0 z-30 w-[440px]">{body}</div>;
}

function CommandDeckPanel({
  phone,
  onClose,
  focusOnMount,
}: {
  phone: boolean;
  onClose: () => void;
  focusOnMount: boolean;
}) {
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState("Ward essentials");
  const sections = ["Ward essentials", "My quick tools", "Search Documents", "Search all clinical areas"];

  return (
    <div
      role="dialog"
      aria-label="Pins and search command deck"
      aria-modal={phone || undefined}
      className={cn(
        "overflow-hidden border border-[#bfcddb] bg-[#fbfcfe] shadow-[0_26px_80px_rgba(20,39,58,0.26)]",
        phone ? "absolute inset-0 z-30 rounded-none" : "absolute inset-x-0 bottom-[82px] z-30 rounded-[1.4rem]",
      )}
    >
      <div className={cn("flex items-center border-b border-[#dde5ec] bg-white", phone ? "gap-2 p-2" : "gap-3 p-3")}>
        {!phone ? (
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#17212b] text-white">
            <Command className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#c9d5df] bg-[#f8fafc] px-3 focus-within:border-[#1d6fb8] focus-within:ring-2 focus-within:ring-[#dcecf8]">
          <Search className="h-4 w-4 shrink-0 text-[#657382]" aria-hidden="true" />
          <span className="sr-only">Search command deck</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Open a pin or search…"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm font-bold text-[#17212b] outline-none"
          />
          {!phone ? (
            <kbd className="rounded-md border border-[#d8e0e7] bg-white px-1.5 py-0.5 text-3xs font-bold text-[#7a8692]">
              ⌘ K
            </kbd>
          ) : null}
        </label>
        <button
          autoFocus={focusOnMount}
          type="button"
          onClick={onClose}
          className={cn("grid min-h-12 min-w-12 place-items-center rounded-xl hover:bg-[#f0f3f6]", focusRing)}
          aria-label="Close command deck"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className={cn("grid", phone ? "grid-cols-1" : "grid-cols-[180px_minmax(0,1fr)]")}>
        <div className={cn("border-[#dde5ec] bg-[#f3f6f9] p-2", phone ? "border-b" : "border-r")}>
          <p className="px-2 pb-1 pt-1 text-3xs font-black uppercase tracking-[0.1em] text-[#74818e]">
            Pins and search
          </p>
          <div className={cn(phone && "flex gap-1 overflow-x-auto pb-1")}>
            {sections.map((section, index) => {
              const icons = [Heart, Wrench, FileText, Globe2];
              const Icon = icons[index];
              const active = activeSection === section;
              return (
                <button
                  key={section}
                  type="button"
                  onClick={() => setActiveSection(section)}
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-xl px-2.5 text-left text-xs font-extrabold transition motion-reduce:transition-none",
                    phone ? "shrink-0" : "w-full",
                    active ? "bg-white text-[#145b94] shadow-sm" : "text-[#526170] hover:bg-white/70",
                    focusRing,
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {section}
                </button>
              );
            })}
          </div>
          {!phone ? (
            <div className="mt-3 border-t border-[#dce3ea] pt-2">
              <button
                type="button"
                className={cn(
                  "flex min-h-12 w-full items-center gap-2 rounded-xl px-2.5 text-xs font-bold text-[#586675] hover:bg-white",
                  focusRing,
                )}
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Manage pins
              </button>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-3xs font-black uppercase tracking-[0.1em] text-[#6c7a88]">
                Selected command · {activeSection}
              </p>
              <p className="text-xs font-semibold text-[#53616e]">
                Pins open destinations; search commands run the current query.
              </p>
            </div>
            {phone ? (
              <DomainCountBadge
                domains={
                  activeSection === "Search all clinical areas" ? domainOrder : ["documents", "medications", "forms"]
                }
                noun={activeSection.startsWith("Search") ? "areas" : "destinations"}
              />
            ) : (
              <DomainIconRail
                domains={
                  activeSection === "Search all clinical areas" ? domainOrder : ["documents", "medications", "forms"]
                }
              />
            )}
          </div>
          <div className="space-y-1.5">
            {[
              {
                title: "Documents",
                meta: "Open guidelines and local policies",
                icon: FileText,
                tag: "Destination",
              },
              { title: "Medications", meta: "Open doses and interactions", icon: Pill, tag: "Destination" },
              {
                title: "Pathology forms",
                meta: "Open frequently used request forms",
                icon: BookOpen,
                tag: "Destination",
              },
            ].map((result, index) => (
              <button
                key={result.title}
                type="button"
                className={cn(
                  "flex min-h-[58px] w-full items-center gap-3 rounded-xl border px-3 text-left transition motion-reduce:transition-none",
                  index === 0 ? "border-[#b8d4e9] bg-[#eff5fc]" : "border-transparent hover:bg-[#f5f7f9]",
                  focusRing,
                )}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#1d6fb8] shadow-sm">
                  <result.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold text-[#17212b]">{result.title}</span>
                  <span className="block truncate text-2xs font-semibold text-[#697684]">{result.meta}</span>
                </span>
                {!phone ? (
                  <span className="rounded-full border border-[#cfdae4] bg-white px-2 py-1 text-3xs font-black text-[#596877]">
                    {result.tag}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div
            className={cn(
              "mt-3 border-t border-[#e3e8ef] pt-3",
              phone ? "grid grid-cols-2 gap-1" : "grid grid-cols-2 gap-2",
            )}
          >
            {["Search all results", "Scope answer evidence"].map((label, index) => {
              const icons = [Search, SlidersHorizontal];
              const Icon = icons[index];
              return (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-xl border border-[#dce3ea] px-3 text-xs font-bold text-[#40505f] hover:bg-[#f7f9fb]",
                    focusRing,
                  )}
                >
                  <Icon className="h-4 w-4 text-[#1d6fb8]" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex min-h-10 items-center justify-between border-t border-[#dde5ec] bg-[#f3f6f9] px-4 text-3xs font-bold text-[#71808e]">
        <span>{phone ? "3 grouped matches" : "↑↓ navigate · Enter open"}</span>
        <span className="min-w-0 truncate pl-2">{query ? `Searching “${query}”` : "Type to search"}</span>
      </div>
    </div>
  );
}

function InlineBuilderPanel({
  phone,
  selectedDomains,
  onToggleDomain,
  onClose,
  focusOnMount,
}: {
  phone: boolean;
  selectedDomains: DomainId[];
  onToggleDomain: (domain: DomainId) => void;
  onClose: () => void;
  focusOnMount: boolean;
}) {
  const panel = (
    <div
      role="dialog"
      aria-label="Edit pin destinations"
      aria-modal={phone || undefined}
      className={cn(
        "border border-[#c7d4e0] bg-[rgba(252,253,254,0.98)] p-3 shadow-[0_22px_55px_rgba(21,42,61,0.2)] backdrop-blur-xl",
        phone ? "w-full rounded-[1.4rem]" : "absolute bottom-[132px] left-0 z-30 w-[500px] rounded-[1.3rem]",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-[#17212b]">Edit Quick pin</h3>
          <p className="text-2xs font-semibold text-[#6b7886]">Choose useful destinations from across the app.</p>
        </div>
        <button
          autoFocus={focusOnMount}
          type="button"
          onClick={onClose}
          className={cn("grid min-h-12 min-w-12 place-items-center rounded-xl hover:bg-[#f1f4f7]", focusRing)}
          aria-label="Close pin destination picker"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className={cn("grid gap-2", phone ? "grid-cols-2" : "grid-cols-3")}>
        {domainOrder.map((domain) => {
          const meta = domainMeta[domain];
          const Icon = meta.icon;
          const active = selectedDomains.includes(domain);
          return (
            <button
              key={domain}
              type="button"
              onClick={() => onToggleDomain(domain)}
              aria-pressed={active}
              className={cn(
                "relative flex min-h-[72px] flex-col items-start justify-between rounded-xl border p-2.5 text-left transition motion-reduce:transition-none",
                active ? "border-[#9fc4e3] bg-[#eff5fc]" : "border-[#dde4eb] bg-white hover:border-[#bdcad6]",
                focusRing,
              )}
            >
              <span className={cn("grid h-8 w-8 place-items-center rounded-lg border", meta.tone)}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-2xs font-extrabold text-[#293540]">{meta.shortLabel}</span>
              {active ? <Check className="absolute right-2 top-2 h-4 w-4 text-[#1d6fb8]" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#e3e8ef] pt-3">
        <span className="text-2xs font-bold text-[#677584]" aria-live="polite">
          {selectedDomains.length} destinations selected
        </span>
        <button
          type="button"
          onClick={onClose}
          className={cn("min-h-12 rounded-xl bg-[#17212b] px-4 text-xs font-extrabold text-white", focusRing)}
        >
          Done
        </button>
      </div>
    </div>
  );

  if (phone) {
    return (
      <div
        data-testid="phone-inline-builder-layer"
        className="absolute inset-x-0 top-0 bottom-[108px] z-30 flex items-end bg-[rgba(7,17,27,0.26)] px-3 pb-2 backdrop-blur-[1px]"
      >
        {panel}
      </div>
    );
  }

  return panel;
}

function Prototype({ direction, phone }: { direction: DirectionId; phone: boolean }) {
  const [open, setOpen] = useState(true);
  const [focusPanelOnOpen, setFocusPanelOnOpen] = useState(false);
  const [selectedLensId, setSelectedLensId] = useState("documents");
  const [wardRoundDomains, setWardRoundDomains] = useState<DomainId[]>(["documents", "medications", "forms"]);
  const [selectedDomains, setSelectedDomains] = useState<DomainId[]>(["documents", "medications", "forms"]);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const selectedLens = lenses.find((lens) => lens.id === selectedLensId) ?? lenses[0];
  const activeDomains = selectedLens.domains;
  const activeLabel = selectedLens.label;

  function closePanel(restoreFocus = true) {
    setOpen(false);
    setFocusPanelOnOpen(false);
    if (restoreFocus) window.setTimeout(() => toggleButtonRef.current?.focus(), 0);
  }

  function togglePanel() {
    setOpen((current) => {
      const next = !current;
      setFocusPanelOnOpen(next);
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setFocusPanelOnOpen(false);
        window.setTimeout(() => toggleButtonRef.current?.focus(), 0);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function toggleDomain(domain: DomainId) {
    setSelectedDomains((current) => {
      if (current.includes(domain)) {
        return current.length === 1 ? current : current.filter((item) => item !== domain);
      }
      return [...current, domain];
    });
  }

  return (
    <AppFrame phone={phone}>
      <div className={cn("absolute inset-0 flex flex-col", phone ? "px-4 pb-5 pt-10" : "px-8 pb-8 pt-12")}>
        {phone && open && direction === "lens-fold" ? (
          <LensFoldPanel
            phone
            selectedLens={selectedLensId}
            wardRoundDomains={wardRoundDomains}
            onWardRoundDomainsChange={setWardRoundDomains}
            onSelectLens={(lensId) => {
              setSelectedLensId(lensId);
              closePanel();
            }}
            onClose={() => closePanel()}
            focusOnMount={focusPanelOnOpen}
          />
        ) : null}
        {phone && open && direction === "command-deck" ? (
          <CommandDeckPanel phone onClose={() => closePanel()} focusOnMount={focusPanelOnOpen} />
        ) : null}
        {phone && open && direction === "inline-builder" ? (
          <InlineBuilderPanel
            phone
            selectedDomains={selectedDomains}
            onToggleDomain={toggleDomain}
            onClose={() => closePanel()}
            focusOnMount={focusPanelOnOpen}
          />
        ) : null}
        {open && !phone ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 bg-[rgba(241,244,248,0.88)] backdrop-blur-[2px]"
            aria-hidden="true"
          />
        ) : null}

        <div className={cn("mx-auto text-center", phone ? "mt-12" : "mt-8")}>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#d6e1ea] bg-white text-[#1d6fb8] shadow-sm">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className={cn("mt-4 font-black tracking-[-0.025em] text-[#080b0f]", phone ? "text-2xl" : "text-3xl")}>
            Find the right clinical source
          </h2>
          <p
            className={cn(
              "mx-auto mt-1 font-semibold leading-6 text-[#637180]",
              phone ? "max-w-[290px] text-sm" : "max-w-lg text-base-minus",
            )}
          >
            Start in Documents, then widen the same search when another clinical area will help.
          </p>
        </div>

        <div className={cn("relative z-20 mx-auto mt-auto w-full", phone ? "max-w-[360px]" : "max-w-[760px]")}>
          {direction === "inline-builder" && !open ? (
            <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1">
              {selectedDomains.map((domain) => {
                const meta = domainMeta[domain];
                const Icon = meta.icon;
                return (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => toggleDomain(domain)}
                    className={cn(
                      "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-extrabold shadow-sm",
                      meta.tone,
                      focusRing,
                    )}
                    aria-label={`Remove ${meta.label}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {meta.shortLabel}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-[#9eb5c8] bg-white px-3 text-xs font-extrabold text-[#315b7d]",
                  focusRing,
                )}
              >
                <CirclePlus className="h-3.5 w-3.5" aria-hidden="true" />
                Add destination
              </button>
            </div>
          ) : null}

          {open && direction === "lens-fold" && !phone ? (
            <LensFoldPanel
              phone={phone}
              selectedLens={selectedLensId}
              wardRoundDomains={wardRoundDomains}
              onWardRoundDomainsChange={setWardRoundDomains}
              onSelectLens={(lensId) => {
                setSelectedLensId(lensId);
                if (phone) setOpen(false);
              }}
              onClose={() => closePanel()}
              focusOnMount={focusPanelOnOpen}
            />
          ) : null}
          {open && direction === "command-deck" && !phone ? (
            <CommandDeckPanel phone={phone} onClose={() => closePanel()} focusOnMount={focusPanelOnOpen} />
          ) : null}
          {open && direction === "inline-builder" && !phone ? (
            <InlineBuilderPanel
              phone={phone}
              selectedDomains={selectedDomains}
              onToggleDomain={toggleDomain}
              onClose={() => closePanel()}
              focusOnMount={focusPanelOnOpen}
            />
          ) : null}

          <Composer
            phone={phone}
            open={open}
            label={activeLabel}
            domains={activeDomains}
            onToggle={togglePanel}
            onInputIntent={() => {
              if (direction !== "inline-builder") closePanel(false);
            }}
            toggleButtonRef={toggleButtonRef}
          />
          <p className="mt-2 text-center text-3xs font-semibold text-[#788594]">
            Do not enter patient-identifiable information.
          </p>
        </div>
      </div>
    </AppFrame>
  );
}

function DesignNote({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="flex items-center gap-2 text-sm font-extrabold text-[color:var(--text-heading)]">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {title}
      </div>
      <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-muted)]">{children}</p>
    </div>
  );
}

export function SearchLensMenuMockupsPage() {
  const [direction, setDirection] = useState<DirectionId>("lens-fold");
  const meta = directionMeta[direction];
  const DirectionIcon = meta.icon;

  return (
    <main className="min-h-screen bg-[color:var(--background)] px-4 py-8 text-[color:var(--text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1560px]">
        <header className="grid gap-6 border-b border-[color:var(--border)] pb-7 lg:grid-cols-[minmax(0,1fr)_minmax(460px,0.9fr)] lg:items-end">
          <div>
            <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-xs font-extrabold text-[color:var(--clinical-accent)]">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              Pins + search menu study
            </span>
            <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl lg:text-5xl">
              Three ways to make “+” useful without turning pins into search filters.
            </h1>
            <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-[color:var(--text-muted)]">
              Each direction keeps Documents search explicit while adding editable pins that open useful destinations
              from across the app. Compare the interaction model—not a cosmetic reskin.
            </p>
          </div>

          <div className="grid gap-2" role="group" aria-label="Choose a mockup direction">
            {(Object.keys(directionMeta) as DirectionId[]).map((id) => {
              const option = directionMeta[id];
              const Icon = option.icon;
              const active = id === direction;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDirection(id)}
                  aria-pressed={active}
                  className={cn(
                    "grid min-h-[64px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 text-left transition motion-reduce:transition-none",
                    active
                      ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] shadow-[0_8px_24px_rgba(29,111,184,0.08)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface)] hover:border-[color:var(--border-strong)]",
                    focusRing,
                  )}
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-xl",
                      active
                        ? "bg-[color:var(--clinical-accent)] text-white"
                        : "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold text-[color:var(--text-heading)]">
                      {option.label}
                    </span>
                    <span className="block truncate text-xs font-medium text-[color:var(--text-muted)]">
                      {option.bestFor}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-3xs font-black uppercase tracking-[0.08em]",
                      active
                        ? "bg-white text-[color:var(--clinical-accent)]"
                        : "bg-[color:var(--surface-subtle)] text-[color:var(--text-soft)]",
                    )}
                  >
                    {option.verdict}
                  </span>
                </button>
              );
            })}
          </div>
        </header>

        <section className="py-7" aria-labelledby="selected-direction-title">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
                Selected direction
              </p>
              <h2
                id="selected-direction-title"
                className="mt-1 flex items-center gap-2 text-2xl font-black tracking-[-0.02em] text-[color:var(--text-heading)]"
              >
                <DirectionIcon className="h-5 w-5 text-[color:var(--clinical-accent)]" aria-hidden="true" />
                {meta.shortLabel}
              </h2>
              <p className="mt-1 text-sm font-medium text-[color:var(--text-muted)]">{meta.strapline}</p>
            </div>
            <p className="max-w-lg text-sm font-semibold leading-6 text-[color:var(--text-muted)]">
              Try closing the panel, editing Ward essentials, choosing global search, or changing the Quick pin. Every
              visible device frame is interactive.
            </p>
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="hidden md:block">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
                Desktop / tablet · fluid 768–1440px treatment
              </p>
              <Prototype key={`${direction}-desktop`} direction={direction} phone={false} />
            </div>
            <div>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
                Phone · up to 390px treatment
              </p>
              <Prototype key={`${direction}-phone`} direction={direction} phone />
            </div>
          </div>
        </section>

        <section
          className="grid gap-3 border-t border-[color:var(--border)] py-7 md:grid-cols-3"
          aria-label="Direction assessment"
        >
          <DesignNote icon={Sparkles} title="Signature">
            {direction === "lens-fold"
              ? "The overlapping pin icons reveal what each pin contains without turning the composer into a settings bar."
              : direction === "command-deck"
                ? "A structured two-pane workspace makes pins and search commands feel related without making them interchangeable."
                : "Pin destinations become graspable objects: visible and removable immediately above the composer."}
          </DesignNote>
          <DesignNote icon={Check} title="Strongest quality">
            {direction === "lens-fold"
              ? "Pins come first, the current mode stays obvious, and widening the search remains a deliberate choice."
              : direction === "command-deck"
                ? "The user can open pinned destinations or launch a scoped search without repeatedly opening different surfaces."
                : "The relationship between pin contents and the stable Documents search scope remains explicit."}
          </DesignNote>
          <DesignNote icon={ShieldCheck} title="Main trade-off">
            {direction === "lens-fold"
              ? "One drill-in is needed to edit a pin, but that keeps the everyday surface calm."
              : direction === "command-deck"
                ? "It is the densest option and risks feeling oversized for users who only need one focused search."
                : "Several pin destinations can consume valuable phone width and need careful horizontal overflow behaviour."}
          </DesignNote>
        </section>
      </div>
    </main>
  );
}
