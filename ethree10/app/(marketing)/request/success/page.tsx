import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RequestSuccessPage() {
  return <main className="container mx-auto max-w-xl space-y-4 px-4 py-20 text-center"><h1 className="text-3xl font-semibold">Request received</h1><p className="text-muted-foreground">Your request code and private tracking link are shown immediately after submission and sent by email when consent is provided.</p><Button asChild><Link href="/request">Submit another request</Link></Button></main>;
}
