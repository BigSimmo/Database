import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { AuthProvider } from "@/lib/supabase/client";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { resolveMetadataBase } from "@/lib/metadata-base";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseMetadata: Metadata = {
  applicationName: "Clinical KB",
  title: "Clinical KB",
  description: "Private medical guideline RAG knowledge base",
  appleWebApp: {
    capable: true,
    title: "Clinical KB",
    statusBarStyle: "black-translucent",
  },
};

/**
 * Generates application metadata with a request-aware base URL.
 *
 * @returns The application metadata, including its resolved base URL.
 */
export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  return {
    ...baseMetadata,
    metadataBase: resolveMetadataBase(requestHeaders, {
      configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      trustedDeploymentDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
      allowRequestOrigin: process.env.NODE_ENV !== "production",
    }),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#060708" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Per-request CSP nonce set by src/proxy.ts. Next.js stamps its own scripts
  // automatically, but the hand-authored theme-flash <script> below is ours, so
  // it must carry the nonce explicitly or the strict script-src blocks it (a
  // silent runtime failure: theme flash returns). Reading headers() opts the app
  // into dynamic rendering — inherent to nonce-based CSP.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Applies the resolved theme before first paint on every route (standalone
            pages don't mount useTheme, and hydration-time toggling flashes light).
            Mirrors resolveThemePreference in src/lib/theme.ts: stored choice wins,
            otherwise the OS preference. Key must match use-theme.ts. */}
        <script
          nonce={nonce}
          // Next.js strips the nonce from the client payload (so scripts can't
          // read it), which reads as a hydration mismatch on this attribute.
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("clinical-kb-theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`,
          }}
        />
        <a
          href="#main-content"
          suppressHydrationWarning
          className="sr-only focus:not-sr-only focus:fixed focus:left-[max(0.75rem,env(safe-area-inset-left))] focus:top-[max(0.75rem,env(safe-area-inset-top))] focus:z-[100] focus:rounded-lg focus:border focus:border-[color:var(--border-lux)] focus:bg-[color:var(--surface-raised)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--text)] focus:shadow-[var(--shadow-elevated)]"
        >
          Skip to main content
        </a>
        <WebVitalsReporter />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
