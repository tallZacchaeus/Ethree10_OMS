import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const areas = [
  ["Intake", "Review and route complete client briefs.", "/team/intake"],
  ["Assignments", "See accountable contributors and active work.", "/team/assignments"],
  ["Workload", "Balance estimates against real capacity and leave.", "/team/workload"],
  ["Reviews", "Approve work or request auditable revisions.", "/team/reviews"],
] as const;

export default function TeamDashboardPage() {
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Team dashboard</h1><p className="text-muted-foreground">Control intake, assignment, capacity, delivery, and internal review.</p></div><div className="grid gap-4 md:grid-cols-2">{areas.map(([title, description, href]) => <Link key={href} href={href}><Card className="h-full transition-colors hover:border-primary/40"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{description}</CardContent></Card></Link>)}</div></div>;
}
