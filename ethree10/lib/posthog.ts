import { PostHog } from "posthog-node";

// Use a mock key if none is provided, allowing dev to run without crashing
export const posthogServer = new PostHog(
  process.env.NEXT_PUBLIC_POSTHOG_KEY || "phc_mock_key_for_dev",
  {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
  }
);
