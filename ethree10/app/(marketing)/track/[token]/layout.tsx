import type { Metadata } from "next";

// Capability URL — keep it out of search indexes.
export const metadata: Metadata = {
  title: "Track your request",
  robots: { index: false, follow: false },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
