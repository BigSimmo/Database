// Day track: server-safe SVG
import { dayTrack, type Hours } from "@/lib/first-nations/hours";

const W = 280;
const TICKS = [0, 6, 12, 18, 24] as const;

export function DayTrack({ hours, now, label }: { hours: Hours | null; now: Date; label: string }) {
  const track = dayTrack(hours ?? undefined, now);
  if (!track) return <p className="text-sm-minus text-[color:var(--surface-summary-muted)]">Hours not set</p>;
  return (
    <svg viewBox={`0 0 ${W} 36`} role="img" aria-label={label} className="w-full">
      <line x1={0} y1={12} x2={W} y2={12} className="stroke-[color:var(--surface-summary-line)]" strokeWidth={1} />
      {track.open ? (
        <rect
          data-mode-identity="first-nations"
          className="fn-on-summary fill-[color:var(--mode-identity)]"
          x={track.open.from * W}
          y={9.5}
          width={(track.open.to - track.open.from) * W}
          height={5}
          rx={2.5}
        />
      ) : null}
      <line
        x1={track.now * W}
        y1={3}
        x2={track.now * W}
        y2={21}
        className="stroke-[color:var(--clinical-accent)]"
        strokeWidth={1.5}
      />
      <circle cx={track.now * W} cy={12} r={3.5} className="fill-[color:var(--clinical-accent)]" />
      {TICKS.map((h) => (
        <text
          key={h}
          x={(h / 24) * W}
          y={32}
          textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"}
          className="nums fill-[color:var(--surface-summary-muted)] text-2xs"
        >
          {String(h).padStart(2, "0")}
        </text>
      ))}
    </svg>
  );
}
