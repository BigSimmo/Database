import type { ServiceRecord } from "@/lib/services";

export type ServiceNavigatorMetrics = {
  meets: number;
  cautions: number;
  rejects: number;
  high: number;
  medium: number;
  low: number;
  unknown: number;
  verified: number;
  localConfirmation: number;
};

export function serviceNavigatorMetrics(records: ServiceRecord[]): ServiceNavigatorMetrics {
  return records.reduce<ServiceNavigatorMetrics>(
    (total, service) => {
      for (const criterion of service.criteria ?? []) {
        if (criterion.tone === "meet") total.meets += 1;
        if (criterion.tone === "caution") total.cautions += 1;
        if (criterion.tone === "reject") total.rejects += 1;
      }

      const confidence = service.verification?.confidence ?? "Unknown";
      if (confidence === "High") total.high += 1;
      else if (confidence === "Medium") total.medium += 1;
      else if (confidence === "Low") total.low += 1;
      else total.unknown += 1;

      const sourceStatus = service.source?.status?.toLowerCase() ?? "";
      const needsLocalConfirmation =
        sourceStatus.includes("local confirmation") ||
        sourceStatus.includes("confirmation required") ||
        sourceStatus.includes("confirmation pending");
      if (!needsLocalConfirmation && service.verification?.locallyVerified === true) {
        total.verified += 1;
      }
      if (needsLocalConfirmation) total.localConfirmation += 1;

      return total;
    },
    { meets: 0, cautions: 0, rejects: 0, high: 0, medium: 0, low: 0, unknown: 0, verified: 0, localConfirmation: 0 },
  );
}

export function canCompareServices(records: ServiceRecord[]) {
  return records.length >= 2;
}
