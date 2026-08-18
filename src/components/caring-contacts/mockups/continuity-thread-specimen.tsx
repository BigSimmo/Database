import { CalendarDays } from "lucide-react";

import {
  ROWAN_SELECTED_SENDING_PREFERENCE,
  SYNTHETIC_SERVICE_SENDING_WINDOWS,
  syntheticPathways,
  syntheticPlannedContacts,
} from "./fixtures";
import { OperationalStatus, SpecimenLabel, SpecimenPanel } from "./mockup-primitives";

const nodePositions = [3, 8, 15, 23, 32, 42, 55, 69, 84, 97] as const;

const formatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Australia/Perth",
});

export function ContinuityThreadSpecimen() {
  const pathway = syntheticPathways[0];

  return (
    <SpecimenPanel
      title="Continuity thread"
      description="Close early contacts widen across the illustrative twelve-month calendar."
      icon={CalendarDays}
    >
      <div className="rounded-[var(--radius-lg)] bg-[color:var(--surface-inset)] p-[var(--pad-card)]">
        <div className="flex flex-wrap items-start justify-between gap-[var(--gap-stack)]">
          <div>
            <SpecimenLabel>Schedule geometry</SpecimenLabel>
            <p className="mt-2 font-semibold text-[color:var(--text)]">{pathway.governanceLabel}</p>
          </div>
          <p className="max-w-md text-sm text-[color:var(--text-muted)]">
            The line encodes elapsed schedule spacing only. It does not encode clinical state, transport outcome,
            wellbeing or response.
          </p>
        </div>

        <figure
          aria-hidden="true"
          className="mt-[var(--gap-block)] overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--surface)] px-[var(--gap-inline)] py-[var(--gap-block)] print:hidden"
          data-testid="caring-contact-continuity-thread"
        >
          <svg viewBox="0 0 100 24" className="h-24 w-full overflow-visible" focusable="false">
            <path
              d="M 3 12 C 22 5, 42 18, 97 12"
              fill="none"
              stroke="var(--clinical-accent)"
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
              className="forced-colors:stroke-[CanvasText]"
            />
            {nodePositions.map((position, index) => (
              <g key={position}>
                <circle
                  cx={position}
                  cy={index < 4 ? (index % 2 === 0 ? 11 : 9) : index % 2 === 0 ? 14 : 12}
                  r="1.5"
                  fill="var(--surface)"
                  stroke="var(--clinical-accent)"
                  strokeWidth="1.25"
                  vectorEffect="non-scaling-stroke"
                  className="forced-colors:fill-[Canvas] forced-colors:stroke-[CanvasText]"
                />
              </g>
            ))}
          </svg>
        </figure>

        <ol
          aria-label="Caring-contact schedule"
          className="mt-[var(--gap-block)] divide-y divide-[color:var(--border)]"
        >
          {syntheticPlannedContacts.map((contact) => (
            <li
              key={contact.id}
              className="grid min-w-0 gap-1 py-[var(--gap-inline)] first:pt-0 last:pb-0 sm:grid-cols-[minmax(5rem,0.6fr)_minmax(8rem,1fr)_minmax(10rem,1.4fr)_auto] sm:items-baseline sm:gap-[var(--gap-stack)]"
            >
              <span className="font-semibold text-[color:var(--text)]">{contact.cadenceLabel}</span>
              <time dateTime={contact.scheduledAt} className="text-sm tabular-nums text-[color:var(--text)]">
                {formatter.format(new Date(contact.scheduledAt))}
              </time>
              <span className="text-sm text-[color:var(--text-muted)]">{contact.windowLabel}</span>
              <OperationalStatus tone={contact.transportState === "Delivered" ? "success" : "neutral"}>
                {contact.transportState}
              </OperationalStatus>
            </li>
          ))}
        </ol>
        <p className="mt-[var(--gap-stack)] text-xs text-[color:var(--text-muted)]">
          Delivered means transport receipt only; it does not show that a message was read, helped or reflected the
          patient’s state. Every future contact remains Scheduled.
        </p>
      </div>

      <div
        className="mt-[var(--gap-block)] grid gap-[var(--gap-stack)] sm:grid-cols-3"
        aria-label="Service sending windows"
      >
        {Object.entries(SYNTHETIC_SERVICE_SENDING_WINDOWS).map(([name, { windowLabel }]) => (
          <div
            key={name}
            className="rounded-[var(--radius-md)] border border-[color:var(--border)] p-[var(--gap-stack)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[color:var(--text-muted)]">
              {name}{" "}
              {name === ROWAN_SELECTED_SENDING_PREFERENCE.window ? "· selected for this plan" : "· service option"}
            </p>
            <p className="mt-1 font-semibold tabular-nums text-[color:var(--text)]">{windowLabel}</p>
          </div>
        ))}
      </div>
    </SpecimenPanel>
  );
}
