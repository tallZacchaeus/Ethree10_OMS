import type { CSSProperties, PropsWithChildren } from "react";
import { cn } from "@/lib/utils/cn";

function animationStyle(delay = 0): CSSProperties | undefined {
  if (!delay) return undefined;
  return { animationDelay: `${delay}ms` };
}

export function AnimatedPage({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("animate-enter", className)}>{children}</div>;
}

export function AnimatedSection({
  children,
  className,
  delay = 0,
}: PropsWithChildren<{ className?: string; delay?: number }>) {
  return (
    <section className={cn("animate-enter", className)} style={animationStyle(delay)}>
      {children}
    </section>
  );
}

export function AnimatedItem({
  children,
  className,
  delay = 0,
}: PropsWithChildren<{ className?: string; delay?: number }>) {
  return (
    <div className={cn("animate-enter rounded-[inherit]", className)} style={animationStyle(delay)}>
      {children}
    </div>
  );
}
