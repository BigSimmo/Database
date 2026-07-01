import { ClipboardCheck, FileSearch, FileText, Route, ShieldCheck, Truck, UserRound } from "lucide-react";

import {
  CompactRecordHomePage,
  type CompactHomeAction,
  type CompactHomePill,
} from "@/components/compact-record-home-page";
import { appModeHomeHref } from "@/lib/app-modes";
import { defaultFormSlug, formRecords } from "@/lib/forms";
import { modeHomeDesktopComposerSlotId } from "@/lib/mode-home-composer";

const taskCards: CompactHomeAction[] = [
  {
    title: "Find a form",
    description: "Search by number, pathway, clock, or keyword.",
    icon: FileSearch,
    href: appModeHomeHref("forms", { focus: true }),
  },
  {
    title: "Readiness checks",
    description: "Review maker, clock, copies, and source.",
    icon: ClipboardCheck,
    href: `/forms/${defaultFormSlug() ?? ""}`,
  },
  {
    title: "Browse pathways",
    description: "Before, current, parallel, and after forms.",
    icon: Route,
    href: appModeHomeHref("forms", {
      query: "forms pathway before current parallel after",
      focus: true,
      run: true,
    }),
  },
];

const commonTasks: CompactHomePill[] = [
  {
    label: "Transport",
    icon: Truck,
    href: appModeHomeHref("forms", { query: "transport forms", focus: true, run: true }),
  },
  {
    label: "Assessment",
    icon: UserRound,
    href: appModeHomeHref("forms", { query: "assessment forms", focus: true, run: true }),
  },
  {
    label: "Transfer",
    icon: Route,
    href: appModeHomeHref("forms", { query: "transfer forms", focus: true, run: true }),
  },
  {
    label: "Treatment",
    icon: ShieldCheck,
    href: appModeHomeHref("forms", { query: "treatment forms", focus: true, run: true }),
  },
];

function verifiedCount() {
  return formRecords.filter((form) => form.verification?.locallyVerified).length;
}

export function FormsHomePage() {
  return (
    <CompactRecordHomePage
      testId="forms-home"
      title="What do you need from forms?"
      subtitle="Search, check, or follow a pathway."
      icon={FileText}
      tasksLabel="Forms tasks"
      taskCards={taskCards}
      quickLinksTitle="Common tasks"
      quickLinks={commonTasks}
      verificationLabel="Source verified"
      verificationBody="MHA 2014 forms"
      verifiedCount={verifiedCount()}
      totalCount={formRecords.length}
      desktopComposerSlotId={modeHomeDesktopComposerSlotId}
    />
  );
}
