"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ShieldAlert } from "lucide-react";
import { toDataURL } from "qrcode";
import { useRouter } from "next/navigation";

export function MfaEnforceSetup() {
  const { toast } = useToast();
  const router = useRouter();
  
  const [qrUrl, setQrUrl] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  
  const generateSecret = trpc.auth.generateMfaSecret.useMutation({
    onSuccess: async (data) => {
      const url = await toDataURL(data.uri);
      setQrUrl(url);
    }
  });

  const verifyMfa = trpc.auth.verifyMfaSession.useMutation({
    onSuccess: () => {
      router.refresh();
    }
  });

  const enableMfa = trpc.auth.verifyAndEnableMfa.useMutation({
    onSuccess: (data) => {
      setRecoveryCodes(data.recoveryCodes);
      setQrUrl("");
      toast({ title: "MFA Enabled", description: "Your account is now protected." });
      // We automatically verify the session right after setting up
      verifyMfa.mutate({ code });
    },
    onError: (err: { message: string }) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });

  if (recoveryCodes.length > 0) {
    return (
      <Card className="w-[500px]">
        <CardHeader>
          <CardTitle>Save your recovery codes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            If you lose access to your device, you can use one of these codes to log in. 
            Keep them in a safe place. They will only be shown once.
          </p>
          <div className="grid grid-cols-2 gap-4 bg-muted p-4 rounded font-mono text-sm mb-6">
            {recoveryCodes.map((c, i) => (
              <div key={i}>{c}</div>
            ))}
          </div>
          <Button className="w-full" onClick={() => router.refresh()}>
            I have saved my codes (Continue)
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-[500px]">
      <CardHeader className="text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
        <CardTitle>Mandatory Security Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Your role requires Two-Factor Authentication (MFA) to be enabled. 
          Please set it up now to continue using the application.
        </p>

        {!qrUrl && (
          <Button 
            className="w-full"
            onClick={() => generateSecret.mutate()}
            disabled={generateSecret.isPending}
          >
            {generateSecret.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Begin Setup
          </Button>
        )}

        {qrUrl && (
          <div className="space-y-4 pt-4">
            <div className="flex justify-center p-4 bg-muted rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="QR Code" className="w-48 h-48 bg-white p-2 rounded" />
            </div>
            <p className="text-sm font-medium">1. Scan this QR code with your authenticator app</p>
            <p className="text-sm font-medium">2. Enter the 6-digit code below to verify</p>
            <div className="flex items-center gap-4">
              <Input
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-center tracking-widest text-lg h-12"
                maxLength={6}
              />
              <Button 
                className="h-12 w-32"
                onClick={() => enableMfa.mutate({ code })}
                disabled={code.length !== 6 || enableMfa.isPending || verifyMfa.isPending}
              >
                {(enableMfa.isPending || verifyMfa.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enable
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
