"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for the App Router. Unlike `app/error.tsx`, this replaces
 * the root layout entirely, so it is the ONLY thing that can recover from an
 * error thrown in `app/layout.tsx` itself or its providers (AuthProvider, fonts,
 * WebVitalsReporter). Because it renders in place of the root layout, `globals.css`
 * is NOT applied — it must supply its own <html>/<body> and inline styles so it
 * still renders correctly when the styling/theming system is exactly what failed.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Fatal error captured by global-error boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          backgroundColor: "#f4f5f7",
          color: "#1a1c1e",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "28rem",
            boxSizing: "border-box",
            borderRadius: "1rem",
            border: "1px solid #e2e4e8",
            backgroundColor: "#ffffff",
            padding: "1.5rem",
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
          }}
        >
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", lineHeight: 1.6, color: "#5b6069" }}>
            The application failed to load. Please try again, or reload the page if the problem persists.
          </p>
          {error.digest && (
            <div
              style={{
                margin: "0 0 1.25rem",
                borderRadius: "0.5rem",
                backgroundColor: "#f4f5f7",
                padding: "0.5rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: "0.75rem",
                color: "#5b6069",
                wordBreak: "break-all",
              }}
            >
              Digest: {error.digest}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                cursor: "pointer",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: "#1a1c1e",
                color: "#ffffff",
                padding: "0.625rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                cursor: "pointer",
                borderRadius: "0.5rem",
                border: "1px solid #e2e4e8",
                backgroundColor: "#ffffff",
                color: "#1a1c1e",
                padding: "0.625rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
