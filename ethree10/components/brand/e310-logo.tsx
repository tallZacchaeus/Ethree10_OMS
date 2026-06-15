import Image from "next/image";
import { cn } from "@/lib/utils/cn";

const LOGO = {
  white: "/e310-white.png", // for navy / dark surfaces
  dark: "/e310-black.png", // for light surfaces
} as const;

/**
 * E310 wordmark (official brand asset).
 * Pick `variant="white"` on dark/navy surfaces and `variant="dark"` on light
 * surfaces so the mark always has proper contrast. Size with a height class
 * (e.g. `h-6 w-auto`); the intrinsic aspect ratio (3848×876) is preserved.
 */
export function E310Logo({
  className,
  variant = "dark",
}: {
  className?: string;
  variant?: "white" | "dark";
}) {
  return (
    <Image
      src={LOGO[variant]}
      alt="E310"
      width={3848}
      height={876}
      priority
      className={cn("h-7 w-auto", className)}
    />
  );
}

/** Compact square mark (E-arrow + ring) for collapsed rails, avatars, favicon. */
export function E310Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="E310"
      className={cn("h-7 w-7 text-foreground", className)}
    >
      <g
        stroke="currentColor"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 18H34" />
        <path d="M14 32H30" />
        <path d="M14 46H34" />
      </g>
      <path d="M30 25L43 32L30 39Z" fill="currentColor" />
    </svg>
  );
}
