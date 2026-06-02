"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { DatabaseBackup } from "lucide-react";

export default function AuditPage() {
  const { toast } = useToast();
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");

  const { data: logs, isLoading } = trpc.audit.list.useQuery({
    entityType: entityType || undefined,
    entityId: entityId || undefined,
    limit: 100,
  });
  const utils = trpc.useUtils();

  const archive = trpc.audit.archiveStaleLogs.useMutation({
    onSuccess: (data) => {
      toast({ title: `Archived ${data.archivedCount} stale logs` });
      void utils.audit.list.invalidate();
    },
    onError: (e) => {
      toast({ title: "Archival failed", description: e.message, variant: "destructive" });
    }
  });

  return (
    <div className="container py-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">System-wide append-only record of state changes.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => archive.mutate()}
          disabled={archive.isPending}
        >
          <DatabaseBackup className="mr-2 h-4 w-4" />
          {archive.isPending ? "Archiving..." : "Archive Logs > 24 mo"}
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Input 
              placeholder="Filter by Entity Type (e.g. Request)" 
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="max-w-[250px]"
            />
            <Input 
              placeholder="Filter by Entity ID" 
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="max-w-[250px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading audit logs...</div>
          ) : logs?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No logs found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {log.actor?.name || "System"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-100">{log.action}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-semibold">{log.entityType}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">{log.entityId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="text-xs space-y-1">
                        {log.before && Object.keys(log.before).length > 0 && (
                          <div className="truncate text-red-600/80">
                            - {JSON.stringify(log.before)}
                          </div>
                        )}
                        {log.after && Object.keys(log.after).length > 0 && (
                          <div className="truncate text-green-600/80">
                            + {JSON.stringify(log.after)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
