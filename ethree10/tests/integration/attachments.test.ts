import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type Project, type User } from "@prisma/client";
import { randomBytes } from "crypto";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { AttachmentService } from "@/server/services/attachment";
import { s3 } from "@/lib/storage";

/**
 * File uploads, against real storage.
 *
 * The point of these tests is the *rejections*. An upload service that happily
 * records a row for a file that never arrived is worse than no upload service —
 * it tells a client their deliverable is ready when the bucket is empty.
 *
 * Requires MinIO: `docker compose up -d minio`.
 */

const db = new PrismaClient();
const tag = randomBytes(4).toString("hex");
const BUCKET = process.env["STORAGE_BUCKET"] ?? "ethree10-dev";

let uploader: User;
let project: Project;
let taskId: string;

beforeAll(async () => {
  uploader = await db.user.create({
    data: { email: `uploader-${tag}@files.test`, name: `Uploader ${tag}` },
  });
  await db.membership.create({
    data: { userId: uploader.id, role: "branch_head", acceptedAt: new Date() },
  });

  const organization = await db.organization.create({
    data: { name: `File Test Client ${tag}`, slug: `file-test-${tag}`, isExternal: true },
  });
  const request = await db.request.create({
    data: {
      code: `REQ-FILE-${tag}`,
      organizationId: organization.id,
      title: "File fixture",
      description: "Fixture request for attachment tests.",
      projectType: "",
    },
  });
  project = await db.project.create({
    data: {
      code: `PRJ-FILE-${tag}`,
      requestId: request.id,
      organizationId: organization.id,
      name: "File fixture project",
    },
  });
  const task = await db.task.create({
    data: { code: `TSK-FILE-${tag}`, projectId: project.id, title: "Fixture task" },
  });
  taskId = task.id;
});

afterAll(async () => {
  await db.attachment.deleteMany({ where: { uploadedById: uploader.id } });
  await db.task.deleteMany({ where: { code: `TSK-FILE-${tag}` } });
  await db.project.deleteMany({ where: { code: `PRJ-FILE-${tag}` } });
  await db.request.deleteMany({ where: { code: `REQ-FILE-${tag}` } });
  await db.organization.deleteMany({ where: { slug: `file-test-${tag}` } });
  await db.auditLog.deleteMany({ where: { actorId: uploader.id } });
  await db.membership.deleteMany({ where: { userId: uploader.id } });
  await db.user.deleteMany({ where: { id: uploader.id } });
  await db.$disconnect();
});

describe("upload validation, before a byte is sent", () => {
  it("refuses an executable", async () => {
    await expect(
      AttachmentService.createUploadUrl(uploader.id, {
        fileName: "payload.exe",
        mimeType: "application/x-msdownload",
        size: 1024,
        taskId,
      }),
    ).rejects.toThrow(/not accepted/i);
  });

  it("refuses a video over the 2GB limit", async () => {
    await expect(
      AttachmentService.createUploadUrl(uploader.id, {
        fileName: "film.mp4",
        mimeType: "video/mp4",
        size: 3 * 1024 ** 3,
        taskId,
      }),
    ).rejects.toThrow(/limit for videos/i);
  });

  it("allows a large video that is inside the limit", async () => {
    const result = await AttachmentService.createUploadUrl(uploader.id, {
      fileName: "promo.mp4",
      mimeType: "video/mp4",
      size: 900 * 1024 * 1024,
      taskId,
    });
    expect(result.uploadUrl).toContain(BUCKET);
  });

  it("refuses an empty file", async () => {
    await expect(
      AttachmentService.createUploadUrl(uploader.id, {
        fileName: "empty.pdf",
        mimeType: "application/pdf",
        size: 0,
        taskId,
      }),
    ).rejects.toThrow(/empty/i);
  });

  it("requires exactly one parent", async () => {
    await expect(
      AttachmentService.createUploadUrl(uploader.id, {
        fileName: "x.pdf",
        mimeType: "application/pdf",
        size: 100,
      }),
    ).rejects.toThrow(/exactly one/i);

    await expect(
      AttachmentService.createUploadUrl(uploader.id, {
        fileName: "x.pdf",
        mimeType: "application/pdf",
        size: 100,
        taskId,
        requestId: taskId,
      }),
    ).rejects.toThrow(/exactly one/i);
  });
});

describe("confirmation is verified against storage", () => {
  it("refuses to record a file that was never uploaded", async () => {
    const { key } = await AttachmentService.createUploadUrl(uploader.id, {
      fileName: "ghost.pdf",
      mimeType: "application/pdf",
      size: 500,
      taskId,
    });
    // Deliberately skip the PUT — this is the phantom-attachment case.
    await expect(
      AttachmentService.confirm(uploader.id, {
        key,
        fileName: "ghost.pdf",
        mimeType: "application/pdf",
        taskId,
      }),
    ).rejects.toThrow(/did not complete/i);

    const rows = await db.attachment.findMany({ where: { storageKey: key } });
    expect(rows).toHaveLength(0);
  });

  it("refuses a key belonging to a different parent", async () => {
    await expect(
      AttachmentService.confirm(uploader.id, {
        key: "attachments/tasks/some-other-task/stolen.pdf",
        fileName: "stolen.pdf",
        mimeType: "application/pdf",
        taskId,
      }),
    ).rejects.toThrow(/does not belong/i);
  });

  it("records the size reported by storage, not by the caller", async () => {
    const body = Buffer.from("brief v1 — actual bytes on disk");
    const { uploadUrl, key } = await AttachmentService.createUploadUrl(uploader.id, {
      fileName: "brief.txt",
      mimeType: "text/plain",
      size: body.byteLength,
      taskId,
    });

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: new Uint8Array(body),
    });
    expect(put.status).toBe(200);

    const attachment = await AttachmentService.confirm(uploader.id, {
      key,
      fileName: "brief.txt",
      mimeType: "text/plain",
      taskId,
    });

    expect(attachment.size).toBe(body.byteLength);
    expect(attachment.storageKey).toBe(key);
    expect(attachment.publicUrl).toContain("/api/files/");
  });

  it("is idempotent — confirming twice returns the same row", async () => {
    const existing = await db.attachment.findFirstOrThrow({ where: { taskId, fileName: "brief.txt" } });
    const again = await AttachmentService.confirm(uploader.id, {
      key: existing.storageKey,
      fileName: "brief.txt",
      mimeType: "text/plain",
      taskId,
    });
    expect(again.id).toBe(existing.id);
  });

  it("discards a zero-byte object rather than recording it", async () => {
    const { key } = await AttachmentService.createUploadUrl(uploader.id, {
      fileName: "hollow.txt",
      mimeType: "text/plain",
      size: 10,
      taskId,
    });
    // Put a genuinely empty object at that key.
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: new Uint8Array(0), ContentType: "text/plain" }));

    await expect(
      AttachmentService.confirm(uploader.id, {
        key,
        fileName: "hollow.txt",
        mimeType: "text/plain",
        taskId,
      }),
    ).rejects.toThrow(/empty/i);

    // And the object is gone, not left lying around pretending to be a file.
    await expect(s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))).rejects.toThrow();
  });
});

describe("removal", () => {
  it("deletes the row and the stored object together", async () => {
    const attachment = await db.attachment.findFirstOrThrow({ where: { taskId, fileName: "brief.txt" } });
    await AttachmentService.remove(uploader.id, attachment.id);

    const rows = await db.attachment.findMany({ where: { id: attachment.id } });
    expect(rows).toHaveLength(0);
    await expect(
      s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: attachment.storageKey })),
    ).rejects.toThrow();
  });
});
