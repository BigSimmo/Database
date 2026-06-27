import type { Metadata } from "next";

import { UserHomeProfilePage } from "@/components/user-home-profile";

export const metadata: Metadata = {
  title: "Home - Clinical KB",
  description: "Logged-in profile home and settings workspace for Clinical KB users.",
};

export default function HomeProfileRoute() {
  return <UserHomeProfilePage />;
}
