import type { Metadata } from "next";

import { UserHomeProfilePage } from "@/components/user-home-profile";

export const metadata: Metadata = {
  title: "User Home Profile Mockup - Clinical KB",
  description: "ChatGPT-style logged-in profile home mockup for Clinical KB users.",
};

export default function UserHomeProfileMockupRoute() {
  return <UserHomeProfilePage />;
}
