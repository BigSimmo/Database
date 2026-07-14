"use client";

import { Eraser, UserRound } from "lucide-react";
import { useId, useState } from "react";

import { usePatientProfile } from "@/components/clinical-dashboard/patient-profile-context";
import { cn, fieldControlPlain, fieldLabel, ToggleSwitch } from "@/components/ui-primitives";
import type { AllergyClass, HepaticSeverity, ScrUnit } from "@/lib/medication-patient-alerts";

const HEPATIC_OPTIONS: { value: HepaticSeverity; label: string }[] = [
  { value: "none", label: "None" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

const SCR_UNIT_OPTIONS: { value: ScrUnit; label: string }[] = [
  { value: "umol/L", label: "µmol/L" },
  { value: "mg/dL", label: "mg/dL" },
];

const ALLERGY_OPTIONS: { value: AllergyClass; label: string }[] = [
  { value: "penicillin", label: "Penicillin" },
  { value: "sulfa", label: "Sulfa" },
  { value: "nsaid", label: "NSAID" },
  { value: "cephalosporin", label: "Cephalosporin" },
  { value: "macrolide", label: "Macrolide" },
  { value: "fluoroquinolone", label: "Fluoroquinolone" },
];

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

const segmentBase =
  "min-h-tap rounded-lg border px-2.5 text-2xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:text-xs";
const segmentActive =
  "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
const segmentIdle =
  "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)]";

function NumberField({
  label,
  unit,
  value,
  onChange,
  testId,
}: {
  label: string;
  unit?: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  testId?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
        {unit ? <span className="ml-1 lowercase text-[color:var(--text-soft)]">({unit})</span> : null}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        onChange={(event) => onChange(parseNumber(event.target.value))}
        className={cn(fieldControlPlain, "nums")}
        data-testid={testId}
      />
    </div>
  );
}

export function PatientProfilePanel({
  variant = "full",
  defaultOpen,
  className,
}: {
  variant?: "full" | "compact";
  /** Initial expanded state; falls back to `variant === "full"` when omitted. */
  defaultOpen?: boolean;
  className?: string;
}) {
  const { profile, updateField, toggleAllergy, clear, isEmpty } = usePatientProfile();
  const [open, setOpen] = useState(defaultOpen ?? variant === "full");
  const allergies = new Set(profile.allergies ?? []);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      data-testid="patient-profile-panel"
      className={cn(
        "group overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]",
        className,
      )}
    >
      <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden="true" />
          <span className="text-sm-minus font-semibold text-[color:var(--text-heading)]">Patient details</span>
          {!isEmpty ? (
            <span className="rounded-full bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-2xs font-semibold text-[color:var(--clinical-accent)]">
              Active
            </span>
          ) : (
            <span className="text-2xs font-medium text-[color:var(--text-soft)]">Optional</span>
          )}
        </span>
        <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
          {open ? "Hide" : "Edit"}
        </span>
      </summary>

      <div className="space-y-3 border-t border-[color:var(--border)] p-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <NumberField
            label="Age"
            unit="years"
            value={profile.ageYears}
            onChange={(value) => updateField("ageYears", value)}
            testId="patient-age"
          />
          <NumberField
            label="eGFR"
            unit="mL/min"
            value={profile.egfr}
            onChange={(value) => updateField("egfr", value)}
            testId="patient-egfr"
          />
          <NumberField
            label="CrCl"
            unit="mL/min"
            value={profile.crcl}
            onChange={(value) => updateField("crcl", value)}
            testId="patient-crcl"
          />
          <NumberField
            label="QTc"
            unit="ms"
            value={profile.qtc}
            onChange={(value) => updateField("qtc", value)}
            testId="patient-qtc"
          />
          <div className="col-span-2 sm:col-span-1">
            <NumberField
              label="Serum creatinine"
              value={profile.scr}
              onChange={(value) => updateField("scr", value)}
              testId="patient-scr"
            />
          </div>
          <fieldset className="col-span-2 min-w-0 sm:col-span-1">
            <legend className={fieldLabel}>Creatinine unit</legend>
            <div className="flex gap-1.5">
              {SCR_UNIT_OPTIONS.map((option) => {
                const active = (profile.scrUnit ?? "umol/L") === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateField("scrUnit", option.value)}
                    className={cn(segmentBase, "flex-1", active ? segmentActive : segmentIdle)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <fieldset className="min-w-0">
          <legend className={fieldLabel}>Hepatic impairment</legend>
          <div className="flex flex-wrap gap-1.5">
            {HEPATIC_OPTIONS.map((option) => {
              const active = (profile.hepatic ?? "none") === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateField("hepatic", option.value === "none" ? null : option.value)}
                  data-testid={`patient-hepatic-${option.value}`}
                  className={cn(segmentBase, active ? segmentActive : segmentIdle)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className={fieldLabel}>Allergies</legend>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGY_OPTIONS.map((option) => {
              const active = allergies.has(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleAllergy(option.value)}
                  data-testid={`patient-allergy-${option.value}`}
                  className={cn(segmentBase, active ? segmentActive : segmentIdle)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="flex items-center gap-2 text-sm-minus font-semibold text-[color:var(--text-heading)]">
            <ToggleSwitch
              enabled={profile.pregnant ?? false}
              onToggle={() => updateField("pregnant", !profile.pregnant)}
              aria-label="Pregnancy"
            />
            Pregnancy
          </span>
          <span className="flex items-center gap-2 text-sm-minus font-semibold text-[color:var(--text-heading)]">
            <ToggleSwitch
              enabled={profile.breastfeeding ?? false}
              onToggle={() => updateField("breastfeeding", !profile.breastfeeding)}
              aria-label="Breastfeeding"
            />
            Breastfeeding
          </span>
          <button
            type="button"
            onClick={clear}
            disabled={isEmpty}
            className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-2.5 text-2xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </button>
        </div>

        <p className="text-2xs leading-4 text-[color:var(--text-soft)]">
          Anonymous values only — no patient‑identifying information is stored. Cleared when the tab closes. Decision
          support, not medical advice.
        </p>
      </div>
    </details>
  );
}
