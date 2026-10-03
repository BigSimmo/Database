import type { MyDaySourceMode } from "@/lib/my-day/model";

/** The short badge each My Day row (and the priority flag) shows before its title. */
export const MODE_BADGE: Record<MyDaySourceMode, string> = {
  "on-call": "OC",
  roster: "ROS",
  cme: "CPD",
  teaching: "TCH",
  "my-work": "ADM",
};
