"use client";

import styles from "./care-plan.module.css";
import {
  FIRST_MINUTE_SECTION_LABEL,
  FULL_PLAN_SECTION_KEYS,
  FULL_PLAN_SECTION_LABEL,
  NOT_RECORDED,
  StatusMark,
  WHY_THIS_PLAN_EXISTS_LABEL,
  SectionFrame,
} from "./prototype-ui";
import { FIRST_MINUTE_CONTENT_KEYS, type ManagementPlanContent } from "./types";

/**
 * The change table between a Current version and the version proposed to replace
 * it.
 *
 * It is a comparison, not a judgement. It says which sections gained content,
 * lost content, changed wording, or stayed word for word the same, and it never
 * says whether a change is an improvement, a risk, or a concern — nothing here
 * reads clinical meaning out of a plan, and a reviewer is the one deciding.
 *
 * Every one of the eleven content fields appears, including the ones that did
 * not change: a reviewer needs to see that a section was left alone as much as
 * that it was rewritten, and a table that omits the unchanged sections cannot be
 * told apart from one that forgot them.
 */

export type ManagementPlanChangeStatus = "Added" | "Changed" | "Removed" | "Unchanged";

export type ManagementPlanChange = {
  key: keyof ManagementPlanContent;
  heading: string;
  status: ManagementPlanChangeStatus;
  currentLines: readonly string[];
  proposedLines: readonly string[];
};

/** The reading order the two tiers already use, assembled once. */
const COMPARED_KEYS: readonly (keyof ManagementPlanContent)[] = [
  ...FIRST_MINUTE_CONTENT_KEYS,
  "whyThisPlanExists",
  ...FULL_PLAN_SECTION_KEYS,
];

const SECTION_HEADING: Record<keyof ManagementPlanContent, string> = {
  ...FIRST_MINUTE_SECTION_LABEL,
  whyThisPlanExists: WHY_THIS_PLAN_EXISTS_LABEL,
  ...FULL_PLAN_SECTION_LABEL,
};

/** A content field as lines, whether it is stored as prose or as a list. Blank
 *  lines are dropped so trailing whitespace never reads as a change. */
function linesOf(content: ManagementPlanContent, key: keyof ManagementPlanContent): readonly string[] {
  const value = content[key];
  const lines = typeof value === "string" ? [value] : value;
  return lines.map((line) => line.trim()).filter((line) => line.length > 0);
}

function statusOf(current: readonly string[], proposed: readonly string[]): ManagementPlanChangeStatus {
  if (current.length === 0 && proposed.length === 0) return "Unchanged";
  if (current.length === 0) return "Added";
  if (proposed.length === 0) return "Removed";
  return current.length === proposed.length && current.every((line, index) => line === proposed[index])
    ? "Unchanged"
    : "Changed";
}

/**
 * A pure comparison of two content objects. Exported on its own so the labelling
 * rule can be proved without a rendered page: `Removed` is the case no pair of
 * fixtures happens to produce, and it is the one whose absence would matter most.
 */
export function diffManagementPlanContent(
  current: ManagementPlanContent,
  proposed: ManagementPlanContent,
): ManagementPlanChange[] {
  return COMPARED_KEYS.map((key) => {
    const currentLines = linesOf(current, key);
    const proposedLines = linesOf(proposed, key);
    return {
      key,
      heading: SECTION_HEADING[key],
      status: statusOf(currentLines, proposedLines),
      currentLines,
      proposedLines,
    };
  });
}

/** Words carry the status; the tone only reinforces what the label already says. */
const STATUS_TONE = {
  Added: "info",
  Changed: "info",
  Removed: "warning",
  Unchanged: "neutral",
} as const satisfies Record<ManagementPlanChangeStatus, "info" | "warning" | "neutral">;

function ComparedLines({ label, lines }: { label: string; lines: readonly string[] }) {
  return (
    <div className={styles.diffColumn}>
      <p className={styles.diffColumnLabel}>{label}</p>
      {lines.length === 0 ? (
        <p className={styles.sectionEmpty}>{NOT_RECORDED}</p>
      ) : (
        <ul className={styles.contentList}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ManagementPlanDiff({
  current,
  proposed,
  currentVersionNumber,
  proposedVersionNumber,
}: {
  current: ManagementPlanContent;
  proposed: ManagementPlanContent;
  currentVersionNumber: number;
  proposedVersionNumber: number;
}) {
  const changes = diffManagementPlanContent(current, proposed);

  return (
    <SectionFrame
      id="care-plan-diff"
      heading="What would change"
      testId="care-plan-diff"
      description={`Comparing Current version ${currentVersionNumber} with proposed version ${proposedVersionNumber}. This table says what is different, not whether the difference is right.`}
    >
      {changes.map((change) => (
        <section
          key={change.key}
          data-testid={`care-plan-diff-${change.key}`}
          aria-labelledby={`care-plan-diff-${change.key}-heading`}
          className={styles.diffSection}
        >
          <div className={styles.diffHead}>
            <h3 id={`care-plan-diff-${change.key}-heading`} className={styles.subsectionHeading}>
              {change.heading}
            </h3>
            <StatusMark tone={STATUS_TONE[change.status]} label={change.status} />
          </div>
          {change.status === "Unchanged" ? (
            <ComparedLines label="Unchanged in both versions" lines={change.proposedLines} />
          ) : (
            <div className={styles.diffColumns}>
              <ComparedLines label={`Current version ${currentVersionNumber}`} lines={change.currentLines} />
              <ComparedLines label={`Proposed version ${proposedVersionNumber}`} lines={change.proposedLines} />
            </div>
          )}
        </section>
      ))}
    </SectionFrame>
  );
}
