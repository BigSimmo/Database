"use client";

import { MyDayCpdPace } from "@/components/my-day/modules/cpd-pace";
import { MyDayNextShift } from "@/components/my-day/modules/next-shift";
import { MyDayNextTeaching } from "@/components/my-day/modules/next-teaching";
import { MyDayOnCallShortcuts } from "@/components/my-day/modules/on-call-shortcuts";
import { MyDayPinnedNumbers } from "@/components/my-day/modules/pinned-numbers";
import { useAuthSession } from "@/lib/supabase/client";

/**
 * The small modules above My Day's merged list. Mount only for a signed-in
 * reader. Keyed by the sign-in epoch so a different account never inherits the
 * previous one's data. Each module draws nothing when it has nothing to say.
 */
export function MyDayModules({ now }: { readonly now: Date }) {
  const { authEpoch } = useAuthSession();
  return <MyDayModulesBody key={authEpoch} now={now} />;
}

function MyDayModulesBody({ now }: { readonly now: Date }) {
  return (
    <>
      <MyDayNextShift now={now} />
      <MyDayPinnedNumbers />
      <MyDayNextTeaching />
      <MyDayCpdPace now={now} />
      <MyDayOnCallShortcuts />
    </>
  );
}
