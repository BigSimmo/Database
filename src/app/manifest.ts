import type { MetadataRoute } from "next";

// PWA manifest — makes the app installable with a proper icon. Icons derive from
// the single brand-mark source: the SVG for modern browsers, plus generated PNG
// "any" and "maskable" sets from app/icons/[variant]. Colours match the light
// default of viewport.themeColor in app/layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clinical KB",
    short_name: "Clinical KB",
    description: "Private medical guideline RAG knowledge base",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icons/icon-192", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icons/icon-512", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icons/maskable-192", type: "image/png", sizes: "192x192", purpose: "maskable" },
      { src: "/icons/maskable-512", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
