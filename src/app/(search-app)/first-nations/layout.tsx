import localFont from "next/font/local";
import type { ReactNode } from "react";
import { Primer } from "@/components/first-nations/primer";

const newsreader = localFont({
  src: "../../../fonts/newsreader-latin-400-italic.woff2",
  weight: "400",
  style: "italic",
  display: "swap",
  preload: false,
  fallback: ["ui-serif", "Georgia", "serif"],
  variable: "--font-fn-serif",
});

export default function FirstNationsLayout({ children }: { children: ReactNode }) {
  // `contents` keeps the shell's layout chain intact; the variable still inherits.
  // The primer lives here so "About this mode" in every page's ••• menu has a sheet to open.
  return (
    <div className={`${newsreader.variable} contents`}>
      <Primer />
      {children}
    </div>
  );
}
