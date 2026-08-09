"use client";

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Paperclip, Trash2, Download, Loader2 } from "lucide-react";

interface Parent {
  taskId?: string;
  requestId?: string;
  deliverableVersionId?: string;
}

function humanBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Upload files straight to storage.
 *
 * The browser PUTs the bytes to a presigned URL — they never travel through the
 * app server, which is what makes multi-hundred-megabyte video possible. The
 * server is only involved to authorise the upload and to confirm afterwards
 * that the object really landed.
 *
 * XHR rather than fetch, because fetch still has no upload progress event and a
 * 900MB upload with no progress bar looks broken.
 */
export function FileUpload({
  parent,
  label = "Attach files",
  canDelete = true,
}: {
  parent: Parent;
  label?: string;
  canDelete?: boolean;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ name: string; percent: number } | null>(null);

  const utils = trpc.useUtils();
  const { data: files = [], isLoading } = trpc.attachments.list.useQuery(parent);
  const createUploadUrl = trpc.attachments.createUploadUrl.useMutation();
  const confirm = trpc.attachments.confirm.useMutation();
  const remove = trpc.attachments.remove.useMutation({
    onSuccess: () => {
      void utils.attachments.list.invalidate(parent);
      toast({ title: "File removed" });
    },
    onError: (error) => toast({ title: "Could not remove", description: error.message, variant: "destructive" }),
  });

  const putWithProgress = (url: string, file: File) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress({ name: file.name, percent: Math.round((event.loaded / event.total) * 100) });
        }
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Storage rejected the upload (${xhr.status})`));
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    });

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    for (const file of Array.from(fileList)) {
      try {
        setProgress({ name: file.name, percent: 0 });

        // 1 — permission, type and size are checked before a byte is sent.
        const { uploadUrl, key } = await createUploadUrl.mutateAsync({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          ...parent,
        });

        // 2 — straight to storage.
        await putWithProgress(uploadUrl, file);

        // 3 — the server verifies the object exists before recording it.
        await confirm.mutateAsync({
          key,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          ...parent,
        });

        toast({ title: "Uploaded", description: file.name });
      } catch (error) {
        toast({
          title: `Could not upload ${file.name}`,
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setProgress(null);
      }
    }

    void utils.attachments.list.invalidate(parent);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={Boolean(progress)}
          onClick={() => inputRef.current?.click()}
        >
          {progress ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="mr-2 h-4 w-4" />
          )}
          {progress ? `Uploading… ${progress.percent}%` : label}
        </Button>
      </div>

      {progress && (
        <div className="space-y-1">
          <p className="truncate text-xs text-muted-foreground">{progress.name}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading files…</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files attached yet.</p>
      ) : (
        <ul className="space-y-1">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {humanBytes(file.size)} · {file.uploadedBy?.name ?? "Unknown"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button asChild size="sm" variant="ghost">
                  <a href={file.publicUrl ?? "#"} target="_blank" rel="noreferrer" aria-label={`Download ${file.fileName}`}>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                {canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={remove.isPending}
                    aria-label={`Remove ${file.fileName}`}
                    onClick={() => remove.mutate({ id: file.id })}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
