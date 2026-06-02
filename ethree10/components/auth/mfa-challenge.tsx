"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export function MfaChallenge() {
  const [code, setCode] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  const verifyMfa = trpc.auth.verifyMfaSession.useMutation({
    onSuccess: () => {
      toast({ title: "Verified", description: "MFA code verified successfully." });
      router.refresh();
    },
    onError: (err: { message: string }) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });

  return (
    <Card className="w-[400px]">
      <CardHeader className="text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-primary mb-4" />
        <CardTitle>Two-Factor Authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Please enter the 6-digit code from your authenticator app to continue.
        </p>
        <div className="flex gap-2">
          <Input 
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono text-center tracking-widest text-lg h-12"
            maxLength={6}
          />
        </div>
        <Button 
          className="w-full h-12"
          disabled={code.length !== 6 || verifyMfa.isPending}
          onClick={() => verifyMfa.mutate({ code })}
        >
          {verifyMfa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify Code
        </Button>
      </CardContent>
    </Card>
  );
}
