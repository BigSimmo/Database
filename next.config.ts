import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const scriptSrc = `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}; `;
const upgradeInsecureRequests = isDevelopment ? "" : "upgrade-insecure-requests; ";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; " +
      "base-uri 'self'; " +
      "object-src 'none'; " +
      "frame-ancestors 'none'; " +
      "form-action 'self'; " +
      upgradeInsecureRequests +
      "img-src 'self' data: blob: https:; " +
      "media-src 'self' https:; " +
      "connect-src 'self' https://sjrfecxgysukkwxsowpy.supabase.co https://*.supabase.co https://api.openai.com; " +
      scriptSrc +
      "style-src 'self' 'unsafe-inline'",
  },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
