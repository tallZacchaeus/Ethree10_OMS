"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CMS_KEYS = [
  { id: "home_hero", label: "Home Hero" },
  { id: "home_services", label: "Services Outline" },
  { id: "about_story", label: "About Story" },
  { id: "footer_copy", label: "Footer Copy" },
];

export default function AdminCmsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  
  const { data: contents, isLoading } = trpc.cms.getAll.useQuery();
  
  const [activeTab, setActiveTab] = useState("home_hero");
  const [localContent, setLocalContent] = useState<Record<string, string>>({});

  const saveMutation = trpc.cms.upsert.useMutation({
    onSuccess: () => {
      utils.cms.getAll.invalidate();
      toast({ title: "Saved", description: "Content updated successfully." });
    },
    onError: (err: { message: string }) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></div>;
  }

  const getContent = (key: string) => {
    if (localContent[key] !== undefined) return localContent[key];
    const match = contents?.find(c => c.key === key);
    return match?.content || "";
  };

  const handleSave = (key: string) => {
    saveMutation.mutate({ key, content: getContent(key) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marketing CMS</h1>
        <p className="text-muted-foreground mt-2">
          Edit content for the public-facing marketing site. Uses Markdown formatting.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Content Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              {CMS_KEYS.map((k) => (
                <TabsTrigger key={k.id} value={k.id}>
                  {k.label}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {CMS_KEYS.map((k) => (
              <TabsContent key={k.id} value={k.id} className="space-y-4">
                <Textarea 
                  className="min-h-[300px] font-mono text-sm leading-relaxed"
                  placeholder={`Enter markdown content for ${k.label}...`}
                  value={getContent(k.id)}
                  onChange={(e) => setLocalContent(prev => ({ ...prev, [k.id]: e.target.value }))}
                />
                <Button 
                  onClick={() => handleSave(k.id)}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save {k.label}
                </Button>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
