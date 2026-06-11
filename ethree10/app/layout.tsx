import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { Toaster } from "@/components/ui/toaster";
import "@/app/globals.css";

// Self-hosted so boot is fast and offline-safe (no Google fetch at build time).
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans.woff2",
  variable: "--font-jakarta",
  display: "swap",
  weight: "400 700",
});

export const metadata: Metadata = {
  title: {
    default: "E310 — Operating Platform",
    template: "%s · E310",
  },
  description:
    "E310 — the all-in-one operating platform. Manage requests, track delivery, and report performance across your teams.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#031629",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans antialiased`}>
        <PostHogProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </PostHogProvider>
        <Toaster />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) { console.log('ServiceWorker registration successful'); },
                    function(err) { console.log('ServiceWorker registration failed: ', err); }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
