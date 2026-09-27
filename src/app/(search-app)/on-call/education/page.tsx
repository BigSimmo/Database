import { redirect } from "next/navigation";

/** Backstop for the proxy's `/on-call/education` → `/teaching/week` redirect (spec §8). */
export default function OnCallEducationRoute() {
  redirect("/teaching/week");
}
