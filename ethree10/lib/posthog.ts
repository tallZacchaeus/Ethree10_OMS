import { PostHog } from "posthog-node";

// A real key is required for analytics to flow. In production we log loudly if it
// is missing rather than silently capturing to a fake project; in dev a disabled
// placeholder keeps the app booting without credentials. No "mock" key is ever
// used that could be mistaken for a working project.
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (!posthogKey && process.env.NODE_ENV === "production") {
  console.error("NEXT_PUBLIC_POSTHOG_KEY missing in production; product analytics disabled.");
}

export const posthogServer = new PostHog(posthogKey || "phc_disabled_no_key", {
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
});
