export type AdminSupportItem = {
  id: string;
  name: string;
  description: string;
  telephoneDisplay: string | null;
  telephoneUri: string | null;
  url: string | null;
  sourceUrl: string;
  updatedOn: string;
};

/**
 * Statewide doctor-support services for Help > Support (spec review 6: "crisis list
 * plus statewide items Josh has checked"). It ships EMPTY on purpose. An item is
 * added only after it is verified against its own official source with the
 * `sources` protocol and signed off by Josh.
 */
export const ADMIN_STATEWIDE_SUPPORT: readonly AdminSupportItem[] = [];
