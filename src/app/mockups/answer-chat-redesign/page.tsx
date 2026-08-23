import type { Metadata } from "next";

import { AnswerChatRedesignMockups } from "@/components/answer-chat-redesign-mockups";

export const metadata: Metadata = {
  title: "Answer chat redesign mockups - Clinical KB",
  description: "Three ChatGPT-style directions for the Answer result, with distinct citation treatments.",
};

export default function AnswerChatRedesignMockupRoute() {
  return <AnswerChatRedesignMockups />;
}
