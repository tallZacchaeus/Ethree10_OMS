import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

export const s3 = new S3Client({
  endpoint: env.STORAGE_ENDPOINT,
  region: "us-east-1", // MinIO requires a region value; the actual value doesn't matter
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
  forcePathStyle: true, // required for MinIO
});

const BUCKET = env.STORAGE_BUCKET;

/** Upload a file and return its public URL */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return publicUrl(key);
}

/** Delete a file by key */
export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Generate a short-lived presigned URL for private file access (default 1 hour) */
export async function presignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

/** Public URL for a file in the public bucket (served via Nginx) */
export function publicUrl(key: string): string {
  return `${env.STORAGE_PUBLIC_URL}/${key}`;
}
