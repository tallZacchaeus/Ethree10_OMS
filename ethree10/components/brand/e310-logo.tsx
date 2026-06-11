import { cn } from "@/lib/utils/cn";

/**
 * E310 wordmark — geometric recreation of the brand mark.
 * "E" = three bars (Workforce / Workflows / Structure) with a forward arrow
 * (operational movement); "O" = the power-ring of a continuous operating system.
 * Uses currentColor, so set the color via `text-*` (white on navy, ink on light).
 */
export function E310Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 172 64"
      fill="none"
      role="img"
      aria-label="E310"
      className={cn("h-7 w-auto text-foreground", className)}
    >
      <g
        stroke="currentColor"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* E — three bars */}
        <path d="M8 16H38" />
        <path d="M8 32H31" />
        <path d="M8 48H38" />
        {/* 3 — squared */}
        <path d="M55 18H73C81 18 82 31 71 32C82 33 81 48 73 48H55" />
        {/* 1 — flagged stem */}
        <path d="M104 16V48" />
        <path d="M97 23L104 16" />
        {/* O — power ring with top notch */}
        <path d="M148 17A17 17 0 1 1 134 17" />
        <path d="M141 13V27" />
      </g>
      {/* Forward arrowhead on the middle bar */}
      <path d="M30 25L43 32L30 39Z" fill="currentColor" />
    </svg>
  );
}

/** Compact square mark (E-arrow + ring) for collapsed rails and avatars. */
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
