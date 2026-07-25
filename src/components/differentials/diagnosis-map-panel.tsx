"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";
import Link from "next/link";
import {
  CircleCheck,
  Crosshair,
  Filter,
  GitCompareArrows,
  Maximize2,
  Minus,
  Move,
  Plus,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { cn, floatingControl, primaryControl, toolbarButton } from "@/components/ui-primitives";
import type { DifferentialLikelihood, DifferentialMapNode, DifferentialRecord } from "@/lib/differentials";

type MapPoint = {
  id: string;
  x: number;
  y: number;
};

type ActivePoint = {
  x: number;
  y: number;
};

type SelectedNode = DifferentialMapNode | "diagnosis";

const graphSizePx = 672;
const minScale = 0.44;
const maxScale = 1.9;
const largeScreenQuery = "(min-width: 1024px)";

const mapPoints: MapPoint[] = [
  { id: "slot-0", x: 50, y: 17 },
  { id: "slot-1", x: 80, y: 34 },
  { id: "slot-2", x: 77, y: 66 },
  { id: "slot-3", x: 50, y: 82 },
  { id: "slot-4", x: 20, y: 45 },
  { id: "slot-5", x: 28, y: 70 },
  { id: "slot-6", x: 24, y: 25 },
  { id: "slot-7", x: 72, y: 19 },
];

const likelihoodTone: Record<DifferentialLikelihood, string> = {
  "most-likely":
    "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]",
  possible:
    "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
  "less-likely": "border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
  "must-not-miss":
    "border-[color:var(--danger)] bg-[color:var(--danger-soft)] text-[color:var(--danger)] ring-2 ring-[color:var(--danger)]/20",
};

const lineTone: Record<DifferentialLikelihood, string> = {
  "most-likely": "var(--clinical-accent)",
  possible: "color-mix(in srgb, var(--clinical-accent) 58%, transparent)",
  "less-likely": "color-mix(in srgb, var(--text-soft) 58%, transparent)",
  "must-not-miss": "var(--danger)",
};

const likelihoodLabels: Record<DifferentialLikelihood, string> = {
  "most-likely": "Most likely",
  possible: "Possible",
  "less-likely": "Less likely",
  "must-not-miss": "Must-not-miss",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distance(a: ActivePoint, b: ActivePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: ActivePoint, b: ActivePoint) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function pointForIndex(index: number) {
  return mapPoints[index % mapPoints.length];
}

function getNodePoint(node: DifferentialMapNode, nodes: DifferentialMapNode[]) {
  const index = nodes.findIndex((item) => item.id === node.id);
  return pointForIndex(index < 0 ? 0 : index);
}

function subscribeLargeScreen(callback: () => void) {
  const media = window.matchMedia(largeScreenQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getLargeScreenSnapshot() {
  return window.matchMedia(largeScreenQuery).matches;
}

const useLargeScreenStore = createBrowserStore(subscribeLargeScreen, getLargeScreenSnapshot, false);

function nodeLabel(node: SelectedNode, record: DifferentialRecord) {
  return node === "diagnosis" ? record.title : node.label;
}

function NodeBadge({ label, selected, className }: { label: string; selected?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-bold",
        selected
          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)]",
        className,
      )}
    >
      {label}
    </span>
  );
}

function MapLegend({ compact = false }: { compact?: boolean }) {
  const entries: Array<{ label: string; className: string }> = [
    { label: "Most likely", className: "bg-[color:var(--clinical-accent)]" },
    {
      label: "Possible",
      className: "bg-[color:var(--clinical-accent-soft)] border border-[color:var(--clinical-accent-border)]",
    },
    { label: "Less likely", className: "bg-[color:var(--surface-subtle)] border border-[color:var(--border)]" },
    { label: "Must-not-miss", className: "bg-[color:var(--danger)]" },
  ];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-[color:var(--text-muted)]",
        compact && "gap-x-3 text-2xs sm:text-xs",
      )}
    >
      {entries.map((entry) => (
        <span key={entry.label} className="inline-flex items-center gap-1.5">
          <span className={cn("h-3 w-3 rounded-full", entry.className)} />
          {entry.label}
        </span>
      ))}
    </div>
  );
}

function MapGraph({
  record,
  selectedId,
  onSelect,
  scale = 1,
  pan = { x: 0, y: 0 },
  filtered = false,
  interactive = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  record: DifferentialRecord;
  selectedId: string;
  onSelect: (node: SelectedNode) => void;
  scale?: number;
  pan?: ActivePoint;
  filtered?: boolean;
  interactive?: boolean;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void;
}) {
  const visibleNodes = filtered ? record.related.filter((node) => node.likelihood === "must-not-miss") : record.related;

  return (
    <div
      data-testid={interactive ? "diagnosis-map-full-canvas" : "diagnosis-map-preview-canvas"}
      className={cn(
        "relative min-h-0 min-w-0 overflow-hidden rounded-lg border border-[color:var(--border)]",
        "bg-[color:var(--surface)] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--border)_40%,transparent)_1px,transparent_1px),linear-gradient(color-mix(in_srgb,var(--border)_40%,transparent)_1px,transparent_1px)] bg-[length:28px_28px,28px_28px]",
        interactive ? "h-full cursor-grab active:cursor-grabbing" : "h-56",
      )}
      style={{ touchAction: interactive ? "none" : "auto" }}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
      onPointerCancel={interactive ? onPointerUp : undefined}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: graphSizePx,
          height: graphSizePx,
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden>
          {visibleNodes.map((node) => {
            const point = getNodePoint(node, record.related);
            return (
              <line
                key={node.id}
                x1="50"
                y1="52"
                x2={point.x}
                y2={point.y}
                stroke={lineTone[node.likelihood]}
                strokeWidth={node.likelihood === "must-not-miss" ? 0.68 : 0.38}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect("diagnosis");
          }}
          className={cn(
            "absolute left-1/2 top-[52%] z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full bg-[color:var(--clinical-accent)] p-3 px-2 text-center font-bold leading-tight break-words text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-elevated)] transition hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--focus)]",
            interactive ? "h-28 w-28 text-base" : "h-14 w-14 text-2xs sm:h-16 sm:w-16",
            selectedId === "diagnosis" && "ring-4 ring-[color:var(--clinical-accent)]/25",
          )}
          aria-pressed={selectedId === "diagnosis"}
          aria-label={`Show details for ${record.title}`}
        >
          {record.title}
        </button>

        {visibleNodes.map((node) => {
          const point = getNodePoint(node, record.related);
          const isSelected = selectedId === node.id;
          return (
            <button
              key={node.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(node);
              }}
              className={cn(
                "absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full border p-2 px-1.5 text-center font-bold leading-tight break-words shadow-[var(--shadow-inset)] transition hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--focus)]",
                interactive ? "h-24 w-24 text-xs" : "h-12 w-12 text-2xs sm:h-14 sm:w-14",
                likelihoodTone[node.likelihood],
                isSelected && "ring-4 ring-[color:var(--focus)]/25",
              )}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              title={node.note}
              aria-pressed={isSelected}
              aria-label={`Show details for ${node.label}`}
            >
              {node.label}
              {node.likelihood === "must-not-miss" && interactive ? (
                <span className="absolute -right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[color:var(--danger)] text-2xs font-bold text-[color:var(--danger-soft)] shadow-[var(--shadow-tight)]">
                  !
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {filtered && visibleNodes.length === 0 ? (
        <div className="absolute inset-x-4 top-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 text-sm font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-soft)]">
          No must-not-miss nodes are tagged for this diagnosis.
        </div>
      ) : null}
    </div>
  );
}

function NodeDetails({
  record,
  selected,
  added,
  onAdd,
  knownRelatedSlugs,
}: {
  record: DifferentialRecord;
  selected: SelectedNode;
  added: boolean;
  onAdd: () => void;
  knownRelatedSlugs?: string[];
}) {
  const selectedIsDiagnosis = selected === "diagnosis";
  // Open the selected related node's own page when it resolves to a real
  // diagnosis; otherwise fall back to (re)opening the current record.
  const openHref =
    !selectedIsDiagnosis && knownRelatedSlugs?.includes(selected.id)
      ? `/differentials/diagnoses/${selected.id}`
      : `/differentials/diagnoses/${record.slug}`;
  const title = nodeLabel(selected, record);
  const likelihood = selectedIsDiagnosis ? "Most likely" : likelihoodLabels[selected.likelihood];
  const details = selectedIsDiagnosis ? record.clinicalHinge : selected.note;
  const fitSection = record.sections.find((section) => section.id === "why-it-fits");
  const riskSection = record.sections.find((section) => section.id === "must-not-miss");

  return (
    <section
      data-testid="diagnosis-map-node-details"
      aria-label={`Details for ${title}`}
      className="grid gap-4 rounded-t-2xl border border-b-0 border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] p-4 shadow-[0_-20px_60px_rgb(15_23_42_/_18%)] lg:rounded-2xl lg:border lg:p-5"
    >
      <div className="mx-auto h-1 w-12 rounded-full bg-[color:var(--border-strong)] lg:hidden" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold leading-tight text-[color:var(--text-heading)]">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{details}</p>
        </div>
        <NodeBadge label={likelihood} selected />
      </div>

      <div className="grid gap-3">
        <div className="rounded-lg border border-[color:var(--success)]/20 bg-[color:var(--success-soft)]/65 p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--success)]">
            <CircleCheck className="h-4 w-4" aria-hidden />
            Why it fits
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
            {selectedIsDiagnosis ? (fitSection?.summary ?? record.subtitle) : selected.note}
          </p>
        </div>
        <div className="rounded-lg border border-[color:var(--danger)]/20 bg-[color:var(--danger-soft)]/65 p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--danger)]">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Must-not-miss
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
            {selectedIsDiagnosis
              ? (riskSection?.summary ?? record.safetySnapshot.summary)
              : record.safetySnapshot.summary}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onAdd} className={cn(floatingControl, "w-full")}>
          <GitCompareArrows className="h-4 w-4" aria-hidden />
          {added ? "In compare" : "Add to compare"}
        </button>
        <Link href={openHref} className={cn(primaryControl, "w-full px-3")}>
          Open diagnosis
        </Link>
      </div>
    </section>
  );
}

export function DiagnosisMapPanel({
  record,
  knownRelatedSlugs,
}: {
  record: DifferentialRecord;
  knownRelatedSlugs?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedNode>("diagnosis");
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<ActivePoint>({ x: 0, y: 0 });
  const [filtered, setFiltered] = useState(false);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const isLargeScreen = useLargeScreenStore();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const activePointers = useRef(new Map<number, ActivePoint>());
  const lastPointer = useRef<ActivePoint | null>(null);
  const lastPinch = useRef<{ distance: number; center: ActivePoint } | null>(null);
  const scaleRef = useRef(scale);
  const panRef = useRef(pan);

  const selectedId = selected === "diagnosis" ? "diagnosis" : selected.id;
  const filteredNodes = useMemo(
    () => record.related.filter((node) => !filtered || node.likelihood === "must-not-miss"),
    [filtered, record.related],
  );

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const resetView = useCallback(() => {
    setScale(isLargeScreen ? 1 : 0.48);
    setPan({ x: 0, y: 0 });
  }, [isLargeScreen]);

  const focusSelected = useCallback(() => {
    if (selected === "diagnosis") {
      resetView();
      return;
    }

    const point = getNodePoint(selected, record.related);
    setScale(1.18);
    setPan({
      x: (50 - point.x) * (graphSizePx / 100) * 0.92,
      y: (52 - point.y) * (graphSizePx / 100) * 0.92,
    });
  }, [record.related, resetView, selected]);

  const updateScale = useCallback((nextScale: number) => {
    setScale(clamp(nextScale, minScale, maxScale));
  }, []);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest("button")) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    activePointers.current.set(event.pointerId, point);
    const pointers = Array.from(activePointers.current.values());
    if (pointers.length === 1) {
      lastPointer.current = point;
      lastPinch.current = null;
    } else if (pointers.length >= 2) {
      lastPinch.current = {
        distance: distance(pointers[0], pointers[1]),
        center: midpoint(pointers[0], pointers[1]),
      };
      lastPointer.current = null;
    }
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(event.pointerId)) return;

    const point = { x: event.clientX, y: event.clientY };
    activePointers.current.set(event.pointerId, point);
    const pointers = Array.from(activePointers.current.values());

    if (pointers.length === 1 && lastPointer.current) {
      const dx = point.x - lastPointer.current.x;
      const dy = point.y - lastPointer.current.y;
      const nextPan = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      panRef.current = nextPan;
      setPan(nextPan);
      lastPointer.current = point;
      return;
    }

    if (pointers.length >= 2 && lastPinch.current) {
      const nextDistance = distance(pointers[0], pointers[1]);
      const nextCenter = midpoint(pointers[0], pointers[1]);
      const ratio = nextDistance / Math.max(lastPinch.current.distance, 1);
      const nextScale = clamp(scaleRef.current * ratio, minScale, maxScale);
      const nextPan = {
        x: panRef.current.x + nextCenter.x - lastPinch.current.center.x,
        y: panRef.current.y + nextCenter.y - lastPinch.current.center.y,
      };
      scaleRef.current = nextScale;
      panRef.current = nextPan;
      setScale(nextScale);
      setPan(nextPan);
      lastPinch.current = { distance: nextDistance, center: nextCenter };
    }
  }, []);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(event.pointerId);
    const pointers = Array.from(activePointers.current.values());
    if (pointers.length === 1) {
      lastPointer.current = pointers[0];
      lastPinch.current = null;
    } else if (pointers.length >= 2) {
      lastPinch.current = {
        distance: distance(pointers[0], pointers[1]),
        center: midpoint(pointers[0], pointers[1]),
      };
      lastPointer.current = null;
    } else {
      lastPointer.current = null;
      lastPinch.current = null;
    }
  }, []);

  function toggleCompare() {
    setAddedIds((current) =>
      current.includes(selectedId) ? current.filter((id) => id !== selectedId) : [...current, selectedId],
    );
  }

  const renderedPan = isLargeScreen ? pan : { x: pan.x, y: pan.y - 150 };

  return (
    <>
      <section
        aria-label="Diagnosis map"
        className="rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-soft)] sm:p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[color:var(--text-heading)]">Diagnosis map</h2>
            <p className="mt-1 hidden text-sm leading-6 text-[color:var(--text-muted)] sm:block">
              {record.related.length} related differentials. Open the full map to pan, zoom, and inspect each node.
            </p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--text-muted)] sm:hidden">
              {record.related.length} related differentials
            </p>
          </div>
          <NodeBadge label={`${record.related.length} nodes`} />
        </div>

        <div className="mt-3 grid gap-3 rounded-lg border border-[color:var(--clinical-accent-border)] bg-[color:var(--surface)] p-2.5 sm:p-3">
          <MapGraph record={record} selectedId="diagnosis" onSelect={setSelected} scale={0.35} />
          <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
            <MapLegend compact />
            <button
              ref={openButtonRef}
              type="button"
              aria-label="Open full diagnosis map"
              onClick={() => {
                setSelected("diagnosis");
                resetView();
                setOpen(true);
              }}
              className={cn(floatingControl, "min-h-tap w-full shrink-0 justify-center px-3 sm:w-auto")}
              data-testid="open-diagnosis-map"
            >
              Open map
              <Maximize2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </section>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Diagnosis map"
        description={`Explore ${record.title} and ${record.related.length} related differentials.`}
        closeLabel="Close diagnosis map"
        mobilePlacement="fullscreen"
        contentClassName="lg:max-w-[76rem]"
        bodyClassName="p-0"
        portal
        returnFocusRef={openButtonRef}
        headerActions={
          <button type="button" onClick={resetView} className={toolbarButton} aria-label="Reset map view">
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
        }
      >
        <div className="relative flex h-[calc(100dvh-5rem)] min-h-[34rem] flex-col bg-[color:var(--background)] lg:grid lg:h-[min(44rem,calc(100dvh-8rem))] lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_minmax(0,1fr)]">
          <div className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface-raised)] p-3 lg:col-span-2">
            <div className="grid gap-3">
              <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
                <button
                  type="button"
                  onClick={resetView}
                  className="inline-flex min-h-tap items-center justify-center gap-2 border-r border-[color:var(--border)] px-3 text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden />
                  Fit all
                </button>
                <button
                  type="button"
                  onClick={focusSelected}
                  className="inline-flex min-h-tap items-center justify-center gap-2 border-r border-[color:var(--border)] px-3 text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]"
                >
                  <Crosshair className="h-4 w-4" aria-hidden />
                  Focus
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextFiltered = !filtered;
                    if (nextFiltered && selected !== "diagnosis" && selected.likelihood !== "must-not-miss") {
                      setSelected("diagnosis");
                    }
                    setFiltered(nextFiltered);
                  }}
                  aria-pressed={filtered}
                  className={cn(
                    "inline-flex min-h-tap items-center justify-center gap-2 px-3 text-sm font-bold hover:bg-[color:var(--surface-subtle)]",
                    filtered ? "text-[color:var(--danger)]" : "text-[color:var(--text)]",
                  )}
                >
                  <Filter className="h-4 w-4" aria-hidden />
                  Filter
                </button>
              </div>
              <MapLegend />
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden lg:col-start-1 lg:row-start-2">
            <MapGraph
              record={record}
              selectedId={selectedId}
              onSelect={setSelected}
              scale={scale}
              pan={renderedPan}
              filtered={filtered}
              interactive
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />

            <div className="absolute left-3 top-[34%] z-30 grid -translate-y-1/2 gap-2 lg:top-1/2">
              <div className="grid overflow-hidden rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-soft)]">
                <button
                  type="button"
                  onClick={() => updateScale(scale + 0.12)}
                  className="grid h-tap w-tap place-items-center border-b border-[color:var(--border)] hover:bg-[color:var(--surface-subtle)]"
                  aria-label="Zoom in"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => updateScale(scale - 0.12)}
                  className="grid h-tap w-tap place-items-center hover:bg-[color:var(--surface-subtle)]"
                  aria-label="Zoom out"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <button
                type="button"
                onClick={resetView}
                className={cn(toolbarButton, "shadow-[var(--shadow-soft)]")}
                aria-label="Fit map to screen"
              >
                <Maximize2 className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="absolute inset-x-3 bottom-3 z-30 hidden items-center justify-center lg:flex">
              <div className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 text-xs font-semibold text-[color:var(--text-muted)] shadow-[var(--shadow-soft)]">
                <Move className="h-4 w-4" aria-hidden />
                Drag to pan
                <span aria-hidden>·</span>
                Use controls or trackpad to zoom
                <span aria-hidden>·</span>
                Select a node for details
              </div>
            </div>
          </div>

          {!isLargeScreen ? (
            <div className="absolute inset-x-0 bottom-0 z-40 max-h-[34dvh] overflow-y-auto">
              <div>
                <NodeDetails
                  record={record}
                  selected={selected}
                  added={addedIds.includes(selectedId)}
                  onAdd={toggleCompare}
                  knownRelatedSlugs={knownRelatedSlugs}
                />
                {filtered ? (
                  <p className="mx-4 mb-4 mt-3 rounded-lg border border-[color:var(--danger)]/20 bg-[color:var(--danger-soft)]/50 p-3 text-xs font-semibold leading-5 text-[color:var(--text-muted)]">
                    Filter is showing {filteredNodes.length} must-not-miss node
                    {filteredNodes.length === 1 ? "" : "s"}. Turn it off to restore the full differential map.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {isLargeScreen ? (
            <div className="min-w-0 border-l border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4 lg:col-start-2 lg:row-start-2">
              <div className="sticky top-4">
                <NodeDetails
                  record={record}
                  selected={selected}
                  added={addedIds.includes(selectedId)}
                  onAdd={toggleCompare}
                  knownRelatedSlugs={knownRelatedSlugs}
                />
                {filtered ? (
                  <p className="mt-3 rounded-lg border border-[color:var(--danger)]/20 bg-[color:var(--danger-soft)]/50 p-3 text-xs font-semibold leading-5 text-[color:var(--text-muted)]">
                    Filter is showing {filteredNodes.length} must-not-miss node
                    {filteredNodes.length === 1 ? "" : "s"}. Turn it off to restore the full differential map.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-3 bottom-[calc(34dvh+0.75rem)] z-30 lg:hidden">
            <p className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--text-muted)]">
              <Move className="h-4 w-4" aria-hidden />
              Drag to pan · pinch or use buttons to zoom · tap a node
            </p>
          </div>
        </div>
      </Sheet>
    </>
  );
}
