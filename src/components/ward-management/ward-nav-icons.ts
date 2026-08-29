import {
  Ambulance,
  BedSingle,
  Building2,
  CircleAlert,
  Hospital,
  ClipboardList,
  Inbox,
  LayoutGrid,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Milestone,
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

import type { WardMode, WardNavId } from "./ward-nav";

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

/**
 * Keyed by `WardNavId`, not `string`, so this map is guarded exactly the way `WARD_VIEW_ICONS`
 * above always has been: a `WARD_NAV` id with no icon here is a compile error, and an icon here
 * for an id `WARD_NAV` no longer carries is a compile error too. It was `Record<string, …>`, which
 * accepted every key and therefore checked nothing, while both the rail and the drawer render the
 * looked-up value directly as a component.
 *
 * This is a STRENGTHENING, not a hole being closed. `tests/ward-nav.test.ts` already asserted the
 * same property and stays — compile-time and test-time fail differently, and keeping both is the
 * point.
 */
export const WARD_NAV_ICONS: Record<WardNavId, LucideIcon> = {
  // The ward index: every ward in the network. `Hospital` rather than a second `Building2`, which
  // the single seeded ward example beside it already uses — two destinations sharing an icon in an
  // icon-only rail are two destinations a reader cannot tell apart.
  wards: Hospital,
  board: LayoutGrid,
  ward: Building2,
  officer: Ambulance,
  ed: Siren,
  handover: ClipboardList,
  escalation: TriangleAlert,
  search: Search,
  discharges: LogOut,
  morning: Sunrise,
  referrals: Inbox,
  // A distance marker on a road, deliberately not a map pin or a compass: this destination is
  // about how far somebody is from home, and nothing in Phase 8 may assert where any hospital is.
  "out-of-area": Milestone,
};
