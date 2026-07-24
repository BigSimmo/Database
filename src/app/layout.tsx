import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { AuthProvider } from "@/lib/supabase/client";
import { AccountDataProvider } from "@/components/account-data-provider";
import { PwaLifecycle } from "@/components/pwa-lifecycle";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { resolveMetadataBase } from "@/lib/metadata-base";
import { APP_THEME_COLORS, THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // The mono face is only used deep in the UI (tabular figures, `kbd`, code) and
  // never in initial/LCP text, so don't preload it on every route — it competes
  // for the critical-path connection. It still loads on-demand via `swap` when
  // first painted. The sans face keeps the default preload.
  preload: false,
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
  const allowRequestOrigin = process.env.NODE_ENV !== "production";
  const requestHeaders = await headers();
  const metadataHeaders = allowRequestOrigin ? requestHeaders : new Headers();
  return {
    ...baseMetadata,
    metadataBase: resolveMetadataBase(metadataHeaders, {
      configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      trustedDeploymentDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
      allowRequestOrigin,
    }),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: APP_THEME_COLORS.dark },
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
  const cookieStore = await cookies();
  const clinicalTheme = cookieStore.get("clinical-theme")?.value;
  const isDark = clinicalTheme === "dark";
  const themeClass = isDark ? "dark" : "";

  return (
    <html
      lang="en-AU"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${themeClass}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Applies the resolved theme before first paint on every route (standalone
            pages don't mount useTheme, and hydration-time toggling flashes light).
            Mirrors resolveThemePreference in src/lib/theme.ts: stored choice wins,
            otherwise the OS preference. Key must match use-theme.ts. The second
            block applies the density/motion preferences (keys must match
            use-app-preferences.ts) so an opted-in choice never flashes in. */}
        <script
          nonce={nonce}
          // Next.js strips the nonce from the client payload (so scripts can't
          // read it), which reads as a hydration mismatch on this attribute.
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `${THEME_BOOTSTRAP_SCRIPT}(function(){try{var p=JSON.parse(localStorage.getItem("clinical-kb-preferences")||"{}");if(p&&typeof p==="object"){if(p.density==="compact"||p.density==="spacious"){document.documentElement.setAttribute("data-density",p.density);}if(p.motion==="reduced"){document.documentElement.setAttribute("data-motion","reduced");}}}catch(e){}})();`,
          }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[color:var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--text)] focus:shadow-[var(--shadow-lux)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[color:var(--focus)]"
        >
          Skip to main content
        </a>
        <WebVitalsReporter />
        <PwaLifecycle />
        <AuthProvider>
          <AccountDataProvider>{children}</AccountDataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
