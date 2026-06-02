"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";
import QRCode from "qrcode";

export default function SecuritySettingsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  
  const [qrUrl, setQrUrl] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  
  const generateSecret = trpc.auth.generateMfaSecret.useMutation({
    onSuccess: async (data) => {
      const url = await QRCode.toDataURL(data.uri);
      setQrUrl(url);
    }
  });

  const enableMfa = trpc.auth.verifyAndEnableMfa.useMutation({
    onSuccess: (data) => {
      setRecoveryCodes(data.recoveryCodes);
      setQrUrl("");
      utils.auth.me.invalidate();
      toast({ title: "MFA Enabled", description: "Your account is now protected." });
    },
    onError: (err: { message: string }) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });

  const disableMfa = trpc.auth.disableMfa.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      setCode("");
      toast({ title: "MFA Disabled", description: "Two-factor authentication has been removed." });
    },
    onError: (err: { message: string }) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });

  if (isLoading) return null;

  const isEnabled = (user as { mfaEnabled?: boolean } | undefined)?.mfaEnabled;

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account security and two-factor authentication.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication (TOTP)</CardTitle>
        </CardHeader>
        <CardContent>
          {isEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle2 className="h-5 w-5" />
                MFA is currently enabled on your account.
              </div>
              <p className="text-sm text-muted-foreground">
                To disable MFA, please enter a code from your authenticator app.
              </p>
              <div className="flex items-center gap-4">
                <Input
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="max-w-[150px] font-mono text-center tracking-widest"
                  maxLength={6}
                />
                <Button 
                  variant="destructive"
                  onClick={() => disableMfa.mutate({ code })}
                  disabled={code.length !== 6 || disableMfa.isPending}
                >
                  {disableMfa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Disable MFA
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account. You will need an authenticator app (like Google Authenticator or Authy) to scan a QR code.
              </p>
              
              {!qrUrl && (
                <Button 
                  onClick={() => generateSecret.mutate()}
                  disabled={generateSecret.isPending}
                >
                  {generateSecret.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Setup Authenticator
                </Button>
              )}

              {qrUrl && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted inline-block rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="QR Code" className="w-48 h-48 bg-white p-2 rounded" />
                  </div>
                  <p className="text-sm font-medium">1. Scan this QR code with your app</p>
                  <p className="text-sm font-medium">2. Enter the 6-digit code below to verify</p>
                  <div className="flex items-center gap-4">
                    <Input
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="max-w-[150px] font-mono text-center tracking-widest"
                      maxLength={6}
                    />
                    <Button 
                      onClick={() => enableMfa.mutate({ code })}
                      disabled={code.length !== 6 || enableMfa.isPending}
                    >
                      {enableMfa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verify & Enable
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {recoveryCodes.length > 0 && (
            <div className="mt-8 p-6 bg-warning-50 border border-warning-200 rounded-lg">
              <h3 className="font-semibold text-warning-900 mb-2">Save your recovery codes</h3>
              <p className="text-sm text-warning-800 mb-4">
                If you lose access to your device, you can use one of these codes to log in. 
                Keep them in a safe place. They will only be shown once.
              </p>
              <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded border font-mono text-sm">
                {recoveryCodes.map((c, i) => (
                  <div key={i}>{c}</div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
