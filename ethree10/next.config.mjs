const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self' https://checkout.paystack.com",
  "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://*.posthog.com https://app.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https://*.ingest.sentry.io https://*.sentry.io https://api.paystack.co https://checkout.paystack.com https://*.posthog.com https://app.posthog.com",
  "frame-src https://checkout.paystack.com",
].join("; ");

export const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), usb=(), bluetooth=(), payment=(self)",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicyReportOnly,
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build output location. Overridable so a deploy can build into a staging
  // directory and swap it in only once the build has succeeded — see
  // scripts/build-atomic.mjs. Unset everywhere else, so this is `.next` for
  // local development and for `next start`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs", "@react-pdf/renderer"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
