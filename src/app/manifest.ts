import type { MetadataRoute } from "next";
import { APP_THEME_COLORS, DEFAULT_THEME } from "@/lib/theme";

// PWA manifest — makes the app installable with a proper icon. Icons derive from
// the single brand-mark source: the SVG for modern browsers, plus generated PNG
// "any" and "maskable" sets from app/icons/[variant]. Colours match the light
// default of viewport.themeColor in app/layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clinical KB",
    short_name: "Clinical KB",
    description: "Private medical guideline RAG knowledge base",
    id: "/",
    start_url: "/",
    scope: "/",
    lang: "en-AU",
    dir: "ltr",
    display: "standalone",
    // Prefer the standalone window but allow a graceful minimal-ui fallback on
    // platforms that cannot honour it; never fall back to fullscreen.
    display_override: ["standalone", "minimal-ui"],
    // Focus the already-open app window on launch instead of spawning a second
    // instance; "auto" lets platforms without the capability use their default.
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    background_color: APP_THEME_COLORS[DEFAULT_THEME],
    theme_color: APP_THEME_COLORS[DEFAULT_THEME],
    categories: ["medical", "productivity", "utilities"],
    prefer_related_applications: false,
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icons/icon-192", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icons/icon-512", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icons/maskable-192", type: "image/png", sizes: "192x192", purpose: "maskable" },
      { src: "/icons/maskable-512", type: "image/png", sizes: "512x512", purpose: "maskable" },
      { src: "/icons/monochrome-192", type: "image/png", sizes: "192x192", purpose: "monochrome" },
      { src: "/icons/monochrome-512", type: "image/png", sizes: "512x512", purpose: "monochrome" },
    ],
    shortcuts: [
      {
        name: "Ask Clinical KB",
        short_name: "Ask",
        description: "Open a source-backed clinical question",
        url: "/?mode=answer&focus=1",
        icons: [{ src: "/icons/icon-192", type: "image/png", sizes: "192x192" }],
      },
      {
        name: "Search documents",
        short_name: "Documents",
        description: "Find source documents and evidence passages",
        url: "/documents/search?mode=documents&focus=1",
        icons: [{ src: "/icons/icon-192", type: "image/png", sizes: "192x192" }],
      },
      {
        name: "Medication guidance",
        short_name: "Medication",
        description: "Open medication dosing and monitoring guidance",
        url: "/?mode=prescribing&focus=1",
        icons: [{ src: "/icons/icon-192", type: "image/png", sizes: "192x192" }],
      },
      {
        name: "Differentials",
        short_name: "Differentials",
        description: "Compare causes and clinical clues",
        url: "/differentials?focus=1",
        icons: [{ src: "/icons/icon-192", type: "image/png", sizes: "192x192" }],
      },
    ],
  };
}
