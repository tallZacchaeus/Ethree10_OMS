"use client";

import posthogClient from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

if (typeof window !== "undefined") {
  posthogClient.init(process.env.NEXT_PUBLIC_POSTHOG_KEY || "phc_mock_key_for_dev", {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
    loaded: (client) => {
      if (process.env.NODE_ENV === "development") client.debug();
    },
    capture_pageview: false // We will handle pageviews manually
  });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthogClient.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, searchParams]);

  return <Provider client={posthogClient}>{children}</Provider>;
}
