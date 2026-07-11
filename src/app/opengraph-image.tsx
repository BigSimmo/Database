import { ImageResponse } from "next/og";

import { brandMarkDataUri } from "@/lib/brand-image";

export const alt = "Clinical KB — private medical guideline knowledge base";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 44,
        background: "#0b1013",
        color: "#ffffff",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori element, not DOM; next/image N/A */}
      <img src={brandMarkDataUri()} width={192} height={192} alt="" />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 78, fontWeight: 700, letterSpacing: -1.5 }}>Clinical KB</div>
        <div style={{ fontSize: 30, color: "#9fb2b8" }}>Private medical guideline knowledge base</div>
      </div>
    </div>,
    { ...size },
  );
}
