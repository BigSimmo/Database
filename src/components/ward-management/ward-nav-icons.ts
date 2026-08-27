import {
  Ambulance,
  BedSingle,
  Building2,
  CircleAlert,
  ClipboardList,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Route,
  Search,
  ShieldCheck,
  Siren,
  Sunrise,
  TriangleAlert,
  Truck,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import type { WardMode } from "./ward-nav";

/**
 * One icon per destination, keyed by the ids in `ward-nav.ts`. Kept out of `ward-nav.ts` so that
 * single source of truth stays plain data with no React dependency, which is what lets
 * `tests/ward-nav.test.ts` and `tests/ward-management.test.ts` read it in a plain Node context.
 *
 * Both the icon rail and the labelled panel/drawer read these, so an icon is chosen once rather
 * than per surface — the rail's icon and the panel's icon can never drift apart.
 */
export const WARD_VIEW_ICONS: Record<WardMode, LucideIcon> = {
  command: LayoutDashboard,
  network: Waypoints,
  queue: ListFilter,
  capacity: BedSingle,
  movements: Route,
  exceptions: CircleAlert,
  transport: Truck,
  governance: ShieldCheck,
};

export const WARD_NAV_ICONS: Record<string, LucideIcon> = {
  ward: Building2,
  officer: Ambulance,
  ed: Siren,
  handover: ClipboardList,
  escalation: TriangleAlert,
  search: Search,
  discharges: LogOut,
  morning: Sunrise,
};
