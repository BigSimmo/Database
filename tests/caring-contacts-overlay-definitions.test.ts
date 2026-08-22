import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MUTATING_OVERLAY_IDS,
  overlayDefinition,
  WORKSPACE_OVERLAY_DEFINITIONS,
  type OverlayDesktopModality,
  type OverlayDismissal,
  type OverlayPhoneModality,
} from "@/components/caring-contacts/workspace/overlays/definitions";

const MATRIX_PATH = "docs/caring-contacts/interaction-matrix.md";

/**
 * The matrix document holds human prose (`Full-screen stage`); the definition
 * table holds the kebab-case union member (`full-screen-stage`). These hand
 * written lookups are the only bridge between the two, and they are deliberately
 * total: an unmapped cell throws and names the row and the offending value.
 *
 * Do NOT replace them with a lowercase-and-hyphenate transform. That would map a
 * corrupted matrix cell onto a plausible-looking value and the frozen record
 * would stop being checked at all.
 */
const PHONE_MODALITY_BY_MATRIX_WORDING: Readonly<Record<string, OverlayPhoneModality>> = {
  "Bottom sheet": "bottom-sheet",
  "Full-screen stage": "full-screen-stage",
  "Session gate": "session-gate",
  "Status banner": "status-banner",
};

const DESKTOP_MODALITY_BY_MATRIX_WORDING: Readonly<Record<string, OverlayDesktopModality>> = {
  Dialog: "dialog",
  "Inspection drawer": "inspection-drawer",
  "Session gate": "session-gate",
  "Status banner": "status-banner",
};

const DISMISSAL_BY_MATRIX_WORDING: Readonly<Record<string, OverlayDismissal>> = {
  "Escape, backdrop, close": "escape-backdrop-close",
  "Recovery action only": "recovery-only",
};

const MUTATION_BY_MATRIX_WORDING: Readonly<
  Record<string, { mutatesState: boolean; requiresFreshAuthentication: boolean }>
> = {
  No: { mutatesState: false, requiresFreshAuthentication: false },
  Yes: { mutatesState: true, requiresFreshAuthentication: false },
  "Yes; two-stage": { mutatesState: true, requiresFreshAuthentication: true },
};

function normalised<Value>(
  table: Readonly<Record<string, Value>>,
  wording: string,
  rowId: string,
  column: string,
): Value {
  const mapped = table[wording];
  if (mapped === undefined) {
    throw new Error(
      `${MATRIX_PATH} row \`${rowId}\`: unmapped ${column} value ${JSON.stringify(wording)}. ` +
        `Known ${column} values: ${Object.keys(table)
          .map((known) => JSON.stringify(known))
          .join(", ")}.`,
    );
  }
  return mapped;
}

/** Parses the frozen matrix out of the interaction-matrix document itself. */
function frozenMatrixRows() {
  const document = readFileSync(resolve(process.cwd(), MATRIX_PATH), "utf8");
  return document
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .map((cells) => ({
      id: cells[1].replace(/`/g, ""),
      phone: cells[3],
      desktop: cells[4],
      mutation: cells[5],
      dismissal: cells[6],
    }));
}

/**
 * The full prohibited vocabulary, not the subset any one surface happens to
 * render. Word boundaries keep `lead` from firing on `already` while still
 * catching the sales sense of the word.
 */
const PROHIBITED_LANGUAGE =
  /\bhigh risk\b|\bsafe\b|\bengagement scores?\b|\bcampaigns?\b|\bleads?\b|\bconversions?\b|\bbest match\b|\binbox(es)?\b|\bconversations?\b|\bclinical risk\b|\brisk scores?\b|\bwellbeing scores?\b|monitor(s|ed|ing)? (the )?repl(y|ies)|repl(y|ies) (are|is) monitored/i;

describe("the frozen 24-overlay contract", () => {
  it("holds exactly 24 unique overlays, 16 of which mutate", () => {
    expect(WORKSPACE_OVERLAY_DEFINITIONS).toHaveLength(24);
    expect(new Set(WORKSPACE_OVERLAY_DEFINITIONS.map((definition) => definition.id)).size).toBe(24);
    expect(MUTATING_OVERLAY_IDS).toHaveLength(16);
    expect(MUTATING_OVERLAY_IDS).toEqual(
      WORKSPACE_OVERLAY_DEFINITIONS.filter((definition) => definition.mutatesState).map((definition) => definition.id),
    );
  });

  it("matches the interaction matrix document row for row", () => {
    const rows = frozenMatrixRows();
    expect(rows).toHaveLength(24);
    rows.forEach((row, index) => {
      const definition = WORKSPACE_OVERLAY_DEFINITIONS[index];
      expect(definition, `matrix row ${index + 1} \`${row.id}\` has no definition`).toBeDefined();
      expect(definition.id).toBe(row.id);

      const mutation = normalised(MUTATION_BY_MATRIX_WORDING, row.mutation, row.id, "mutation");
      expect(definition.mutatesState, `${row.id}.mutatesState`).toBe(mutation.mutatesState);
      expect(definition.requiresFreshAuthentication, `${row.id}.requiresFreshAuthentication`).toBe(
        mutation.requiresFreshAuthentication,
      );
      expect(definition.phoneModality, `${row.id}.phoneModality`).toBe(
        normalised(PHONE_MODALITY_BY_MATRIX_WORDING, row.phone, row.id, "phone modality"),
      );
      expect(definition.desktopModality, `${row.id}.desktopModality`).toBe(
        normalised(DESKTOP_MODALITY_BY_MATRIX_WORDING, row.desktop, row.id, "desktop modality"),
      );
      expect(definition.dismissal, `${row.id}.dismissal`).toBe(
        normalised(DISMISSAL_BY_MATRIX_WORDING, row.dismissal, row.id, "dismissal"),
      );
    });
  });

  it("requires fresh authentication for exactly withdrawal and reassignment", () => {
    expect(
      WORKSPACE_OVERLAY_DEFINITIONS.filter((definition) => definition.requiresFreshAuthentication).map((d) => d.id),
    ).toEqual(["withdrawal", "reassignment"]);
  });

  it("carries no empty field and no prohibited clinical language", () => {
    for (const definition of WORKSPACE_OVERLAY_DEFINITIONS) {
      for (const [field, value] of Object.entries(definition)) {
        if (typeof value === "string") expect(value.trim(), `${definition.id}.${field}`).not.toBe("");
        if (typeof value === "string") expect(value, `${definition.id}.${field}`).not.toMatch(PROHIBITED_LANGUAGE);
        if (typeof value === "string") expect(value.trim(), `${definition.id}.${field}`).not.toBe("-");
      }
      expect(`${definition.summary} ${definition.decision}`).not.toMatch(
        /monitor(ed|ing)? replies|patient is safe|risk score|inbox|conversation/i,
      );
    }
  });

  it("looks a definition up by id and returns null for an unknown id", () => {
    expect(overlayDefinition("pause")?.title).toBe(
      WORKSPACE_OVERLAY_DEFINITIONS.find((definition) => definition.id === "pause")?.title,
    );
    expect(overlayDefinition("not-an-overlay")).toBeNull();
  });
});
