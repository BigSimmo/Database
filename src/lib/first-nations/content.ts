import approvalsJson from "@/data/first-nations/approvals.json";
import pagesJson from "@/data/first-nations/pages.json";
import emhsJson from "@/data/first-nations/profiles/emhs.json";
import sourcesJson from "@/data/first-nations/sources.json";
import mapJson from "@/data/first-nations/wa-regions-map.json";
import { z } from "zod";
import {
  approvalSchema,
  mapSchema,
  parseFirstNationsContent,
  profileSchema,
  sourceSchema,
  type ContactBlock,
  type ServiceProfile,
  type Source,
} from "@/lib/first-nations/content-schema";
import type { ModelInputs } from "@/lib/first-nations/view-model";

const CONTENT = parseFirstNationsContent(pagesJson);
const APPROVALS = z
  .object({ version: z.literal(1), approvals: z.array(approvalSchema) })
  .strict()
  .parse(approvalsJson).approvals;
const PROFILE: ServiceProfile = profileSchema.parse(emhsJson);
const SOURCES: Source[] = z
  .object({ version: z.literal(1), sources: z.array(sourceSchema) })
  .strict()
  .parse(sourcesJson).sources;
const MAP = mapSchema.parse(mapJson);

export const getServiceProfile = (): ServiceProfile | null => (PROFILE.enabled ? PROFILE : null);
export const getSources = (): Source[] => SOURCES;

export function getContacts(): ContactBlock[] {
  return [...CONTENT.statewideContacts, ...(PROFILE.enabled ? PROFILE.contacts : [])];
}

export function loadModelInputs(): ModelInputs {
  return {
    content: CONTENT,
    approvals: APPROVALS,
    profile: getServiceProfile(),
    sources: Object.fromEntries(SOURCES.map((s) => [s.id, s])),
    map: MAP,
  };
}
