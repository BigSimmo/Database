"use client";

import { MyDayCpdPace } from "@/components/my-day/modules/cpd-pace";
import { MyDayNextShift } from "@/components/my-day/modules/next-shift";
import { MyDayNextTeaching, useMyDayNextTeachingSession } from "@/components/my-day/modules/next-teaching";
import { MyDayPinnedNumbers } from "@/components/my-day/modules/pinned-numbers";
import { MyDayQuickActions } from "@/components/my-day/modules/quick-actions";
import { MyDayRestOfToday, restOfTodayChips } from "@/components/my-day/modules/rest-of-today";
import { useRosterShifts } from "@/components/roster/use-roster-shifts";
import type { MyDayItem } from "@/lib/my-day/model";
import { useAuthSession } from "@/lib/supabase/client";

/**
 * The small modules above My Day's merged list. Mount only for a signed-in
 * reader. Keyed by the sign-in epoch so a different account never inherits the
 * previous one's data. Each module draws nothing when it has nothing to say.
 * The roster and teaching reads happen once here and are shared by the modules.
 */
export function MyDayModules({ now, items }: { readonly now: Date; readonly items: readonly MyDayItem[] }) {
  const { authEpoch } = useAuthSession();
  return <MyDayModulesBody key={authEpoch} now={now} items={items} />;
}

function MyDayModulesBody({ now, items }: { readonly now: Date; readonly items: readonly MyDayItem[] }) {
  const roster = useRosterShifts();
  const session = useMyDayNextTeachingSession();
  const chips = restOfTodayChips({ items, roster, session, now });
  return (
    <>
      <MyDayNextShift state={roster} now={now} />
      <MyDayRestOfToday chips={chips} />
      <MyDayQuickActions />
      <MyDayPinnedNumbers />
      <MyDayNextTeaching session={session} />
      <MyDayCpdPace now={now} />
    </>
  );
}
