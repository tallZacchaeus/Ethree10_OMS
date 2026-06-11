import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Tone = "default" | "signature" | "accent";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  deltaLabel = "vs last week",
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  /** Percentage change; positive renders teal/up, negative red/down. */
  delta?: number;
  deltaLabel?: string;
  tone?: Tone;
  className?: string;
}) {
  const signature = tone === "signature";
  const up = (delta ?? 0) >= 0;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop",
        signature
          ? "border-transparent bg-ink-950 text-white"
          : "border-border/70 bg-card text-card-foreground",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-[13px] font-medium",
            signature ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              signature
                ? "bg-white/10 text-brand-300"
                : tone === "accent"
                  ? "bg-lime-100 text-lime-700"
                  : "bg-brand-50 text-brand-600",
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </span>
        )}
      </div>

      <p
        className={cn(
          "mt-3 text-3xl font-semibold tracking-tight tabular-nums",
          signature && "text-white",
        )}
      >
        {value}
      </p>

      <div className="mt-1.5 flex items-center gap-2">
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium",
              up
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
              signature && "bg-white/10 text-white",
            )}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
        {(hint || delta !== undefined) && (
          <p
            className={cn(
              "text-xs",
              signature ? "text-white/60" : "text-muted-foreground",
            )}
          >
            {delta !== undefined ? deltaLabel : hint}
          </p>
        )}
      </div>
    </div>
  );
}
