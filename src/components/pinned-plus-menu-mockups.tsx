"use client";

import {
  BookOpen,
  Calculator,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  Heart,
  Menu,
  Pencil,
  Pill,
  Plus,
  Search,
  Sparkles,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/components/ui-primitives";

type Direction = "unified" | "rail" | "palette";
type Device = "desktop" | "tablet" | "phone";
type PreviewState = "closed" | "open" | "edit";
type DestinationId = "documents" | "medications" | "forms" | "monitoring" | "calculators" | "favourites" | "recent";
type Pin = { id: string; name: string; destinations: DestinationId[] };

const destinations: Record<DestinationId, { label: string; detail: string; icon: LucideIcon; tone: string }> = {
  documents: {
    label: "Documents",
    detail: "Guidelines and local policies",
    icon: FileText,
    tone: "bg-sky-50 text-sky-700",
  },
  medications: {
    label: "Medications",
    detail: "Doses and interactions",
    icon: Pill,
    tone: "bg-emerald-50 text-emerald-700",
  },
  forms: {
    label: "Pathology forms",
    detail: "Frequently used request forms",
    icon: BookOpen,
    tone: "bg-amber-50 text-amber-700",
  },
  monitoring: {
    label: "Monitoring",
    detail: "Physical health checks",
    icon: Sparkles,
    tone: "bg-violet-50 text-violet-700",
  },
  calculators: {
    label: "Calculators",
    detail: "Clinical scoring tools",
    icon: Calculator,
    tone: "bg-indigo-50 text-indigo-700",
  },
  favourites: { label: "Favourites", detail: "Saved pages and sources", icon: Heart, tone: "bg-rose-50 text-rose-700" },
  recent: { label: "Recent items", detail: "Return to recent work", icon: Clock3, tone: "bg-slate-100 text-slate-700" },
};

const startingPins: Pin[] = [
  { id: "ward", name: "Ward essentials", destinations: ["documents", "medications", "forms", "monitoring"] },
  { id: "tools", name: "My quick tools", destinations: ["calculators", "favourites", "recent"] },
];

const directionMeta: Array<{ id: Direction; label: string; note: string; verdict: string }> = [
  {
    id: "unified",
    label: "Unified plus menu",
    note: "Pins and search choices in one calm, attached surface.",
    verdict: "Recommended",
  },
  {
    id: "rail",
    label: "Pinned icon rail",
    note: "Keeps your small pin icons one tap from the composer.",
    verdict: "Fastest",
  },
  {
    id: "palette",
    label: "Search command palette",
    note: "A keyboard-friendly launcher for pins and search areas.",
    verdict: "Power users",
  },
];

function Constellation({ pin, size = "md" }: { pin: Pin; size?: "sm" | "md" }) {
  const shown = pin.destinations.slice(0, 3);
  const extra = pin.destinations.length - shown.length;
  return (
    <span
      role="img"
      aria-label={`${pin.name} contains ${pin.destinations.map((id) => destinations[id].label).join(", ")}`}
      className="inline-flex shrink-0 items-center"
    >
      {shown.map((id, index) => {
        const item = destinations[id];
        const Icon = item.icon;
        return (
          <span
            key={id}
            className={cn(
              "grid rounded-full border-2 border-white shadow-sm",
              size === "sm" ? "h-6 w-6" : "h-8 w-8",
              index > 0 && "-ml-2",
              item.tone,
            )}
          >
            <Icon className={cn("m-auto", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden="true" />
          </span>
        );
      })}
      {extra > 0 && (
        <span
          className={cn(
            "-ml-2 grid rounded-full border-2 border-white bg-slate-900 font-bold text-white shadow-sm",
            size === "sm" ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-[10px]",
          )}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

function SearchChoices({ compact = false }: { compact?: boolean }) {
  const choices = [
    { label: "Search Documents", detail: "Current area", icon: FileText, active: true },
    { label: "Search all clinical areas", detail: "Global search", icon: Search, active: false },
    { label: "Choose another area", detail: "Medications, services, tools…", icon: Plus, active: false },
  ];
  return (
    <div className={cn("grid gap-2", !compact && "sm:grid-cols-3")}>
      {choices.map((choice) => {
        const Icon = choice.icon;
        return (
          <button
            key={choice.label}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-2xl border p-3 text-left",
              choice.active ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200",
            )}
          >
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                choice.active ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-950">{choice.label}</span>
              <span className="block truncate text-xs text-slate-500">{choice.detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PinCard({
  pin,
  selected,
  onSelect,
  onEdit,
  expanded = false,
}: {
  pin: Pin;
  selected?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  expanded?: boolean;
}) {
  return (
    <article className={cn("rounded-2xl border bg-white", selected ? "border-blue-300 shadow-sm" : "border-slate-200")}>
      <div className="flex items-center gap-3 p-3">
        <button onClick={onSelect} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left">
          <Constellation pin={pin} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-slate-950">{pin.name}</span>
            <span className="block text-xs text-slate-500">{pin.destinations.length} app destinations</span>
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-slate-400 transition", expanded && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        <button
          onClick={onEdit}
          aria-label={`Edit ${pin.name}`}
          className="grid min-h-12 min-w-12 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-blue-700"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      {expanded && (
        <div className="grid grid-cols-2 gap-1 border-t border-slate-100 p-2">
          {pin.destinations.map((id) => {
            const item = destinations[id];
            const Icon = item.icon;
            return (
              <button
                key={id}
                className="flex min-h-12 items-center gap-2 rounded-xl px-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Icon className="h-4 w-4 text-blue-700" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

function UnifiedMenu({
  pins,
  selected,
  setSelected,
  edit,
  phone,
}: {
  pins: Pin[];
  selected: string;
  setSelected: (id: string) => void;
  edit: (pin: Pin) => void;
  phone: boolean;
}) {
  return (
    <section
      role="dialog"
      aria-label="Search and pinned shortcuts"
      className={cn(
        "absolute z-20 overflow-y-auto border border-slate-200 bg-[#fbfcfe] shadow-[0_24px_70px_rgba(15,23,42,.2)]",
        phone
          ? "bottom-[5.5rem] left-2 right-2 max-h-[72%] rounded-[1.75rem] p-3"
          : "bottom-[5.8rem] left-6 w-[31rem] max-h-[72%] rounded-3xl p-4",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-blue-700">Quick access</p>
          <h3 className="mt-1 text-xl font-bold text-slate-950">Your pins</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Shortcuts you chose from anywhere in the app.</p>
        </div>
        <button className="min-h-12 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-blue-700">
          <Plus className="mr-1 inline h-4 w-4" />
          {phone ? "New" : "New pin"}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {pins.map((pin) => (
          <PinCard
            key={pin.id}
            pin={pin}
            selected={pin.id === selected}
            expanded={pin.id === selected}
            onSelect={() => setSelected(pin.id)}
            onEdit={() => edit(pin)}
          />
        ))}
      </div>
      <div className="my-4 h-px bg-slate-200" />
      <h3 className="text-base font-bold text-slate-950">Search in</h3>
      <p className="mt-1 text-xs text-slate-500">Choose where this query should run.</p>
      <div className="mt-3">
        <SearchChoices compact />
      </div>
    </section>
  );
}

function RailMenu({
  pins,
  selected,
  setSelected,
  edit,
  phone,
}: {
  pins: Pin[];
  selected: string;
  setSelected: (id: string) => void;
  edit: (pin: Pin) => void;
  phone: boolean;
}) {
  const pin = pins.find((item) => item.id === selected) ?? pins[0];
  return (
    <section
      role="dialog"
      aria-label="Pinned icon rail menu"
      className={cn(
        "absolute z-20 rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,.2)]",
        phone ? "bottom-[5.5rem] left-2 right-2 p-3" : "bottom-[5.8rem] left-1/2 w-[42rem] -translate-x-1/2 p-4",
      )}
    >
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {pins.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item.id)}
            aria-pressed={item.id === selected}
            className={cn(
              "flex min-h-14 shrink-0 items-center gap-2 rounded-2xl border px-3",
              item.id === selected ? "border-blue-400 bg-blue-50" : "border-slate-200",
            )}
          >
            <Constellation pin={item} size="sm" />
            <span className="text-sm font-bold text-slate-950">{item.name}</span>
          </button>
        ))}
        <button
          className="grid min-h-14 min-w-14 shrink-0 place-items-center rounded-2xl border border-dashed border-blue-300 text-blue-700"
          aria-label="Create a pin"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      <div className={cn("mt-2 grid gap-3 rounded-2xl bg-slate-50 p-3", !phone && "grid-cols-[1fr_1.25fr]")}>
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Selected pin</p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">{pin.name}</h3>
            </div>
            <button
              onClick={() => edit(pin)}
              aria-label={`Edit ${pin.name}`}
              className="grid min-h-12 min-w-12 place-items-center rounded-full bg-white text-blue-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {pin.destinations.map((id) => {
              const item = destinations[id];
              const Icon = item.icon;
              return (
                <button
                  key={id}
                  className="flex min-h-12 items-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-slate-700"
                >
                  <Icon className="h-4 w-4 text-blue-700" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className={cn(phone && "border-t border-slate-200 pt-3")}>
          <h3 className="text-base font-bold text-slate-950">Search in</h3>
          <div className="mt-2">
            <SearchChoices compact />
          </div>
        </div>
      </div>
    </section>
  );
}

function PaletteMenu({
  pins,
  selected,
  setSelected,
  edit,
  phone,
}: {
  pins: Pin[];
  selected: string;
  setSelected: (id: string) => void;
  edit: (pin: Pin) => void;
  phone: boolean;
}) {
  return (
    <section
      role="dialog"
      aria-label="Search command palette"
      className={cn(
        "absolute z-20 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,.24)]",
        phone
          ? "bottom-[5.5rem] left-2 right-2 max-h-[74%]"
          : "left-1/2 top-1/2 w-[44rem] -translate-x-1/2 -translate-y-1/2",
      )}
    >
      <div className="flex min-h-16 items-center gap-3 border-b border-slate-200 px-4">
        <Search className="h-5 w-5 text-slate-400" />
        <span className="text-sm text-slate-500">Open a pin or choose where to search…</span>
        <kbd className="ml-auto rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
          ⌘ K
        </kbd>
      </div>
      <div className="max-h-[32rem] overflow-y-auto p-3">
        <h3 className="px-2 text-xs font-bold uppercase tracking-[.14em] text-slate-500">Your pins</h3>
        <div className={cn("mt-2 grid gap-2", !phone && "grid-cols-2")}>
          {pins.map((pin) => (
            <div
              key={pin.id}
              className={cn(
                "flex items-center rounded-2xl border p-2",
                pin.id === selected ? "border-blue-300 bg-blue-50" : "border-slate-200",
              )}
            >
              <button
                onClick={() => setSelected(pin.id)}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Constellation pin={pin} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-950">{pin.name}</span>
                  <span className="block text-xs text-slate-500">Open {pin.destinations.length} destinations</span>
                </span>
              </button>
              <button
                onClick={() => edit(pin)}
                aria-label={`Edit ${pin.name}`}
                className="grid min-h-12 min-w-12 place-items-center text-blue-700"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <h3 className="mt-4 px-2 text-xs font-bold uppercase tracking-[.14em] text-slate-500">Search in</h3>
        <div className="mt-2">
          <SearchChoices compact={phone} />
        </div>
      </div>
    </section>
  );
}

function PinEditor({
  pin,
  save,
  cancel,
  phone,
}: {
  pin: Pin;
  save: (pin: Pin) => void;
  cancel: () => void;
  phone: boolean;
}) {
  const [draft, setDraft] = useState(pin);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cancel]);
  function toggle(id: DestinationId) {
    setDraft((current) => ({
      ...current,
      destinations: current.destinations.includes(id)
        ? current.destinations.length === 1
          ? current.destinations
          : current.destinations.filter((entry) => entry !== id)
        : [...current.destinations, id],
    }));
  }
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${pin.name} pin`}
      className={cn(
        "absolute z-30 flex flex-col overflow-hidden border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,.28)]",
        phone ? "inset-2 rounded-[1.75rem]" : "bottom-6 right-6 top-6 w-[28rem] rounded-3xl",
      )}
    >
      <header className="flex items-start justify-between border-b border-slate-200 p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-blue-700">Edit pin</p>
          <h3 className="mt-1 text-xl font-bold text-slate-950">{pin.name}</h3>
        </div>
        <button
          onClick={cancel}
          aria-label="Close pin editor"
          className="grid min-h-12 min-w-12 place-items-center rounded-full hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <label className="text-sm font-bold text-slate-700">
          Pin name
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-950"
          />
        </label>
        <div className="mt-5 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-950">App destinations</h4>
          <span className="text-xs font-semibold text-slate-500">
            {draft.destinations.length} destinations selected
          </span>
        </div>
        <div className="mt-2 space-y-2">
          {(Object.keys(destinations) as DestinationId[]).map((id) => {
            const item = destinations[id];
            const Icon = item.icon;
            const active = draft.destinations.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                aria-label={`${active ? "Remove" : "Add"} ${item.label}`}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-2xl border p-3 text-left",
                  active ? "border-blue-300 bg-blue-50" : "border-slate-200",
                )}
              >
                <span className={cn("grid h-9 w-9 place-items-center rounded-full", item.tone)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-950">{item.label}</span>
                  <span className="block truncate text-xs text-slate-500">{item.detail}</span>
                </span>
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full border",
                    active ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300",
                  )}
                >
                  {active && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <footer className="grid grid-cols-2 gap-2 border-t border-slate-200 p-4">
        <button onClick={cancel} className="min-h-12 rounded-xl border border-slate-300 font-bold text-slate-700">
          Cancel
        </button>
        <button
          onClick={() => save(draft)}
          disabled={!draft.name.trim()}
          className="min-h-12 rounded-xl bg-blue-700 font-bold text-white disabled:opacity-40"
        >
          Save changes
        </button>
      </footer>
    </section>
  );
}

function AppPreview({
  direction,
  device,
  state,
  pins,
  setPins,
  setState,
}: {
  direction: Direction;
  device: Device;
  state: PreviewState;
  pins: Pin[];
  setPins: (pins: Pin[]) => void;
  setState: (state: PreviewState) => void;
}) {
  const phone = device === "phone";
  const [selected, setSelected] = useState(pins[0].id);
  const trigger = useRef<HTMLButtonElement>(null);
  const previousState = useRef(state);
  const selectedPin = pins.find((pin) => pin.id === selected) ?? pins[0];
  useEffect(() => {
    if (previousState.current !== "closed" && state === "closed") trigger.current?.focus();
    previousState.current = state;
  }, [state]);
  const edit = (pin: Pin) => {
    setSelected(pin.id);
    setState("edit");
  };
  const shared = { pins, selected, setSelected, edit, phone };
  return (
    <section
      aria-label={`${device[0].toUpperCase()}${device.slice(1)} mockup preview`}
      className={cn(
        "relative mx-auto overflow-hidden border border-slate-200 bg-[#f3f6fa] shadow-[0_22px_70px_rgba(15,23,42,.14)]",
        device === "desktop" && "h-[45rem] w-full max-w-[74rem] rounded-[2rem]",
        device === "tablet" && "h-[48rem] w-full max-w-[48rem] rounded-[2rem]",
        phone && "h-[47rem] w-full max-w-[24.375rem] rounded-[2.5rem]",
      )}
    >
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4">
        <button aria-label="Open navigation" className="grid min-h-12 min-w-12 place-items-center">
          <Menu className="h-5 w-5" />
        </button>
        <button className="flex min-h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold shadow-sm">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-700 text-white">
            <FileText className="h-4 w-4" />
          </span>
          Documents
          <ChevronDown className="h-4 w-4" />
        </button>
        <button aria-label="Account" className="grid min-h-12 min-w-12 place-items-center rounded-full">
          <UserRound className="h-5 w-5" />
        </button>
      </header>
      <main className={cn("px-6 text-center", phone ? "pt-16" : "pt-24")}>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-blue-100 bg-white text-blue-700 shadow-sm">
          <FileText className="h-5 w-5" />
        </span>
        <h2 className={cn("mt-5 font-black tracking-[-.035em] text-slate-950", phone ? "text-2xl" : "text-4xl")}>
          Find the right clinical source
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-slate-500">
          Search Documents first, then widen the same query when another clinical area will help.
        </p>
        {state === "closed" && (
          <div className="mx-auto mt-8 flex w-fit items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <Constellation pin={pins[0]} size="sm" />
            <span className="text-left">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Pinned by you</span>
              <span className="text-sm font-bold text-slate-800">{pins.length} pins ready</span>
            </span>
          </div>
        )}
      </main>
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white",
          phone ? "p-3 pb-4" : "p-4",
        )}
      >
        <div className={cn("mx-auto flex items-center gap-2", !phone && "max-w-4xl")}>
          <button
            ref={trigger}
            onClick={() => setState(state === "closed" ? "open" : "closed")}
            aria-label={state === "closed" ? "Open search and pins menu" : "Close search and pins menu"}
            aria-expanded={state !== "closed"}
            className={cn(
              "relative grid min-h-12 min-w-12 place-items-center rounded-2xl transition",
              state === "closed" ? "bg-blue-50 text-blue-700" : "bg-blue-700 text-white",
            )}
          >
            <Plus className={cn("h-5 w-5 transition", state !== "closed" && "rotate-45")} />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
          </button>
          <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-300 px-3 text-left text-sm text-slate-500">
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search Documents</span>
          </div>
          <button className="min-h-12 rounded-2xl bg-blue-700 px-4 text-sm font-bold text-white">Search</button>
        </div>
      </div>
      {state !== "closed" && (
        <div
          aria-hidden="true"
          className="absolute bottom-[5rem] left-0 right-0 top-16 z-10 bg-slate-950/[0.06] backdrop-blur-[1px]"
        />
      )}
      {state !== "closed" && direction === "unified" && <UnifiedMenu {...shared} />}
      {state !== "closed" && direction === "rail" && <RailMenu {...shared} />}
      {state !== "closed" && direction === "palette" && <PaletteMenu {...shared} />}
      {state === "edit" && (
        <PinEditor
          pin={selectedPin}
          phone={phone}
          cancel={() => setState("open")}
          save={(pin) => {
            setPins(pins.map((item) => (item.id === pin.id ? pin : item)));
            setState("open");
          }}
        />
      )}
    </section>
  );
}

export function PinnedPlusMenuMockupsPage() {
  const [direction, setDirection] = useState<Direction>("unified");
  const [device, setDevice] = useState<Device>("desktop");
  const [state, setState] = useState<PreviewState>("closed");
  const [pins, setPins] = useState(startingPins);
  return (
    <main className="min-h-screen bg-[#edf2f7] px-4 py-6 text-slate-950 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[82rem]">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">Search + menu · revised study</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">
              Editable pins, without changing search by accident
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Pins open useful app destinations. Search choices control where the query runs. Both live in one coherent
              + menu.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
            <span className="font-bold text-blue-800">Recommendation:</span> Unified plus menu
          </div>
        </header>
        <nav aria-label="Mockup directions" className="mt-6 grid gap-2 md:grid-cols-3">
          {directionMeta.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setDirection(item.id)}
              aria-pressed={direction === item.id}
              className={cn(
                "min-h-20 rounded-2xl border p-4 text-left",
                direction === item.id
                  ? "border-blue-500 bg-blue-700 text-white shadow-md"
                  : "border-slate-200 bg-white hover:border-blue-300",
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-[.14em] opacity-70">
                0{index + 1} · {item.verdict}
              </span>
              <span className="mt-1 block text-base font-bold">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 opacity-75">{item.note}</span>
            </button>
          ))}
        </nav>
        <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
          <div role="group" aria-label="Preview device" className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {(["desktop", "tablet", "phone"] as Device[]).map((item) => (
              <button
                key={item}
                onClick={() => setDevice(item)}
                aria-label={`${item[0].toUpperCase()}${item.slice(1)} preview`}
                aria-pressed={device === item}
                className={cn(
                  "min-h-11 flex-1 rounded-lg px-4 text-sm font-bold capitalize sm:flex-none",
                  device === item ? "bg-white text-blue-700 shadow-sm" : "text-slate-500",
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Preview state" className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                { id: "closed", label: "Closed" },
                { id: "open", label: "Menu open" },
                { id: "edit", label: "Edit pin" },
              ] as Array<{ id: PreviewState; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setState(item.id)}
                aria-pressed={state === item.id}
                className={cn(
                  "min-h-11 flex-1 rounded-lg px-4 text-sm font-bold sm:flex-none",
                  state === item.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 rounded-[2.25rem] border border-slate-200 bg-white/60 p-2 sm:p-5">
          <AppPreview key={`${direction}-${device}`} {...{ direction, device, state, pins, setPins, setState }} />
        </div>
        <footer className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Pins mean</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A named collection of destinations chosen from anywhere in the app—not a search filter.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Small icons mean</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The first three destinations inside a pin. +N communicates the remainder without visual clutter.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Users edit</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Pin name and included destinations. Search area remains an explicit choice every time.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
