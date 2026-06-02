import { Badge, type BadgeProps } from "@/components/ui/badge";

type Variant = NonNullable<BadgeProps["variant"]>;

const URGENCY: Record<string, { label: string; variant: Variant }> = {
  low: { label: "Low", variant: "neutral" },
  medium: { label: "Medium", variant: "info" },
  high: { label: "High", variant: "warning" },
  critical: { label: "Critical", variant: "destructive" },
};

export function UrgencyTag({ value }: { value: string }) {
  const entry = URGENCY[value] ?? { label: value, variant: "neutral" as Variant };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
