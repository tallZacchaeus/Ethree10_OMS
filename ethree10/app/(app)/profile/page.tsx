"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

function initials(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: user } = trpc.auth.me.useQuery();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [hours, setHours] = useState(40);
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setTimezone(user.timezone);
      setHours(user.workingHoursPerWeek);
      setAvatarUrl(user.avatarUrl ?? "");
    }
  }, [user]);

  const update = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      void utils.auth.me.invalidate();
      // The topbar avatar is rendered by the server layout, so a client-side
      // cache invalidation alone would leave it showing the old image until
      // the next full navigation.
      router.refresh();
      toast({ title: "Profile updated" });
    },
    onError: (error) =>
      toast({ title: "Could not update profile", description: error.message, variant: "destructive" }),
  });

  const trimmedAvatar = avatarUrl.trim();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="My profile" description="Your staff identity, timezone, and capacity preferences." />
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>Role, team, position, and skills are managed by agency leadership.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate({
                name,
                timezone,
                workingHoursPerWeek: hours,
                avatarUrl: trimmedAvatar,
              });
            }}
          >
            <div className="flex items-center gap-4">
              {/* Keyed so clearing the URL remounts and the initials come back —
                  see the same note in account-menu.tsx. */}
              <Avatar key={trimmedAvatar || "none"} className="h-16 w-16">
                {trimmedAvatar ? <AvatarImage src={trimmedAvatar} alt={name || "You"} /> : null}
                <AvatarFallback>{initials(name || user?.email || "?")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="profile-avatar">Profile photo URL</Label>
                <Input
                  id="profile-avatar"
                  type="url"
                  inputMode="url"
                  placeholder="https://example.com/photo.jpg"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to fall back to your initials.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-timezone">Timezone</Label>
              <Input
                id="profile-timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-hours">Working hours per week</Label>
              <Input
                id="profile-hours"
                type="number"
                min={1}
                max={80}
                value={hours}
                onChange={(event) => setHours(Number(event.target.value))}
              />
            </div>
            <Button type="submit" disabled={update.isPending || name.trim().length < 2}>
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
