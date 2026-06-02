"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/constants";
import { EmptyState } from "@/components/ui-ext/empty-state";

export default function SkillsMarketplacePage() {
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");

  const { data: skills, isLoading: loadingSkills } = trpc.members.getAllSkills.useQuery();
  const { data: members, isLoading: loadingMembers } = trpc.members.searchBySkill.useQuery(
    { skillId: selectedSkillId },
    { enabled: !!selectedSkillId }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills Marketplace"
        description="Find agency members with specific skills for your project."
      />

      <div className="w-full max-w-sm">
        <label className="text-sm font-medium mb-2 block">Required Skill</label>
        <Select value={selectedSkillId} onValueChange={setSelectedSkillId}>
          <SelectTrigger>
            <SelectValue placeholder={loadingSkills ? "Loading skills..." : "Select a skill"} />
          </SelectTrigger>
          <SelectContent>
            {skills?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="pt-4">
        {!selectedSkillId ? (
          <EmptyState
            title="Select a skill"
            description="Choose a skill from the dropdown to find qualified members."
          />
        ) : loadingMembers ? (
          <div className="text-center py-12 text-muted-foreground">Searching members...</div>
        ) : members && members.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => (
              <Card key={m.userId}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="h-12 w-12 border">
                    <AvatarImage src={m.avatarUrl || ""} alt={m.name} />
                    <AvatarFallback>{m.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{m.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.department || "No department"}
                    </p>
                  </div>
                  <div>
                    <Badge variant={m.level === "expert" ? "info" : "neutral"}>
                      {m.level ? humanize(m.level) : "Unknown"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No members found"
            description="Nobody in the agency has this skill listed on their profile."
          />
        )}
      </div>
    </div>
  );
}
