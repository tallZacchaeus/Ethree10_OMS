import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4"><Card className="max-w-md"><CardHeader><CardTitle>Staff access required</CardTitle><CardDescription>Your account does not have an active Ethree10 staff membership. Ask an agency administrator to invite or reactivate you.</CardDescription></CardHeader><CardContent><Button asChild><Link href="/login">Return to sign in</Link></Button></CardContent></Card></div>;
}
