import type { ServiceRecord } from "@/lib/service-ranker";

export const serviceCoreGroups = [
  { id: "urgent", label: "Crisis & urgent", shortLabel: "Urgent" },
  { id: "public", label: "Public mental health", shortLabel: "Public MH" },
  { id: "aod", label: "Alcohol & other drugs", shortLabel: "AOD" },
  { id: "community", label: "Community & specialist support", shortLabel: "Community" },
] as const;

export type ServiceCoreGroupId = (typeof serviceCoreGroups)[number]["id"];

const urgentPattern = /\b(?:acute|crisis|emergenc\w*|urgent|suicide|after[- ]?hours|triage)\b/i;
const publicPattern =
  /\b(?:public mental health|community mental health|public community|public treatment|statewide public|regional adult|older[- ]adult public|hospital mental health|(?:north|south|east|metropolitan|wa country|child and adolescent)[\w ]{0,24}health service)\b/i;
const aodPattern = /\b(?:aod|alcohol|drug|addiction|gambling|withdrawal|detox|rehab(?:ilitation)?)\b/i;
const communityPattern =
  /\b(?:psychosocial|recovery|community support|accommodation|homeless|housing|residential|ndis|disability|carer|family|youth|aboriginal|torres strait islander|lgbtq|veteran|perinatal|legal|advocacy|practical support|specialist)\b/i;

function serviceGroupFields(service: ServiceRecord) {
  return [
    service.title,
    service.subtitle,
    service.bestUse,
    service.route,
    service.catalogueLabel,
    ...(service.tags ?? []),
    ...(service.statusChips ?? []).map((chip) => chip.label),
  ].filter((value): value is string => Boolean(value?.trim()));
}

function includesPatternInFields(fields: readonly string[], pattern: RegExp): boolean {
  return fields.some((value) => pattern.test(value));
}

export function readServiceCoreGroup(value: string | null | undefined): ServiceCoreGroupId | null {
  return serviceCoreGroups.some((group) => group.id === value) ? (value as ServiceCoreGroupId) : null;
}

export function serviceCoreGroupIds(service: ServiceRecord): ServiceCoreGroupId[] {
  const fields = serviceGroupFields(service);
  const groups: ServiceCoreGroupId[] = [];
  if (includesPatternInFields(fields, urgentPattern)) groups.push("urgent");
  if (includesPatternInFields(fields, publicPattern)) groups.push("public");
  if (includesPatternInFields(fields, aodPattern)) groups.push("aod");
  if (includesPatternInFields(fields, communityPattern)) groups.push("community");
  return groups.length ? groups : ["community"];
}

export function serviceMatchesCoreGroup(service: ServiceRecord, group: ServiceCoreGroupId | null) {
  return group === null || serviceCoreGroupIds(service).includes(group);
}

export function serviceCoreGroupLabel(group: ServiceCoreGroupId | null) {
  if (group === null) return "All services";
  return serviceCoreGroups.find((item) => item.id === group)?.label ?? "All services";
}
