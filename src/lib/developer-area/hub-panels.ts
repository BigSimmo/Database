import { CARING_CONTACT_MOCKUP_ROUTES } from "@/components/caring-contacts/mockups/routes";

export type HubPanelGroup = "work" | "clinical" | "system" | "reference";

export type HubPanel = {
  id: string;
  name: string;
  summary: string;
  group: HubPanelGroup;
  /** 1 = built now. 2–4 = declared placeholder; flipping the phase and adding an href is the whole change. */
  phase: 1 | 2 | 3 | 4;
  href?: string;
};

export const HUB_PANELS: readonly HubPanel[] = [
  {
    id: "task-ledger",
    name: "Task ledger",
    summary: "Outstanding work, in recommended order",
    group: "work",
    phase: 1,
    href: "/mockups/development/ledger",
  },
  {
    id: "work-in-flight",
    name: "Work in flight",
    summary: "Open changes, their checks, and whether reviewed",
    group: "work",
    phase: 2,
  },
  { id: "decision-log", name: "Decision log", summary: "Why things are the way they are", group: "work", phase: 4 },

  {
    id: "source-review",
    name: "Source review queue",
    summary: "Documents shaping answers most, with no qualified human sign-off",
    group: "clinical",
    phase: 3,
  },
  {
    id: "source-currency",
    name: "Source currency",
    summary: "Age, publisher, jurisdiction, superseded guidance",
    group: "clinical",
    phase: 3,
  },
  {
    id: "governance-debt",
    name: "Governance debt",
    summary: "Missing metadata and unattributed reviews",
    group: "clinical",
    phase: 3,
  },
  {
    id: "answer-quality",
    name: "Answer quality",
    summary: "Retrieval scores and document quality signals",
    group: "clinical",
    phase: 3,
  },
  {
    id: "hazard-register",
    name: "Hazard register",
    summary: "Known clinical risks and their mitigations",
    group: "clinical",
    phase: 4,
  },

  // No `environment` card: the environment strip renders as its own section on
  // the hub, so a card pointing at `#developer-hub-environment` would be a
  // self-link, not a destination.
  {
    id: "database-drift",
    name: "Database drift",
    summary: "Schema and function differences against the repo",
    group: "system",
    phase: 3,
  },
  { id: "ingestion", name: "Ingestion", summary: "Stuck, failed, and queued document jobs", group: "system", phase: 3 },
  { id: "errors", name: "Errors and alerts", summary: "What is failing for real users", group: "system", phase: 4 },
  { id: "test-health", name: "Test health", summary: "Unstable and quarantined tests", group: "system", phase: 2 },
  {
    id: "budgets",
    name: "Speed and weight",
    summary: "Page weight and performance budgets",
    group: "system",
    phase: 4,
  },

  {
    id: "documentation",
    name: "Documentation",
    summary: "Every document, its age, and its broken links",
    group: "reference",
    phase: 2,
  },
  { id: "routes", name: "Routes and modes", summary: "Every page and all 15 modes", group: "reference", phase: 2 },
  // Two real prototype cards, not one generic self-linking "Prototypes" card.
  // This is also what preserves the Caring Contact and Ward Flow entries the
  // spec requires to survive the hub rewrite. Import the Caring Contact route
  // from `@/components/caring-contacts/mockups/routes` — do not hardcode it.
  {
    id: "caring-contact",
    name: "Caring contact",
    summary: "Coordination prototype: 13 routes and its system states",
    group: "reference",
    phase: 1,
    href: CARING_CONTACT_MOCKUP_ROUTES.today,
  },
  {
    id: "ward-flow",
    name: "Ward flow",
    summary: "Queue, capacity, transport, movements",
    group: "reference",
    phase: 1,
    href: "/ward-management",
  },
  { id: "commands", name: "Commands", summary: "What each repository command does", group: "reference", phase: 4 },
];

export function panelsInGroup(group: HubPanelGroup): HubPanel[] {
  return HUB_PANELS.filter((panel) => panel.group === group);
}
