import { createHash } from "node:crypto";
import type { Approval, Block, Section, Situation } from "@/lib/first-nations/content-schema";

export type ApprovalState = "approved" | "awaiting";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

export function approvalState(subjectId: string, content: unknown, approvals: readonly Approval[]): ApprovalState {
  const record = approvals.find((a) => a.subjectId === subjectId);
  return record && record.contentSha256 === stableHash(content) ? "approved" : "awaiting";
}

export const sectionApprovalState = (section: Section, approvals: readonly Approval[]): ApprovalState =>
  approvalState(section.id, section, approvals);

export const situationApprovalState = (situation: Situation, approvals: readonly Approval[]): ApprovalState =>
  approvalState(`situation:${situation.id}`, situation, approvals);

export const blockApprovalState = (block: Block, approvals: readonly Approval[]): ApprovalState =>
  approvalState(block.id, block, approvals);
