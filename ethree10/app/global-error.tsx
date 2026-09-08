"use client";

import { useEffect } from "react";
import { captureCriticalFailure } from "@/lib/observability";

/**
 * Last line of defence: an error thrown by the root layout itself.
 *
 * This replaces the whole document, so it cannot use the app's layout, fonts or
 * components — hence the inline styles. Without it Next shows its own default
 * screen, which in production says nothing at all and gives the reader no way
 * forward.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureCriticalFailure("global-error", error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#fafaf9",
          color: "#1c1917",
        }}
      >
        <main style={{ maxWidth: "34rem", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Something broke</h1>
          <p style={{ color: "#57534e", lineHeight: 1.6 }}>
            The page could not load. This has been reported. Trying again often works — the
            problem is usually momentary.
          </p>
          {error.digest && (
            <p style={{ color: "#a8a29e", fontSize: "0.8rem", marginTop: "1rem" }}>
              Reference: <code>{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.6rem 1.2rem",
              borderRadius: "0.5rem",
              border: "1px solid #d6d3d1",
              background: "#1c1917",
              color: "#fafaf9",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
