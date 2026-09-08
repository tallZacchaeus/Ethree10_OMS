import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";

/**
 * Create the storage bucket if it is not already there.
 *
 * The integration suite writes real objects to MinIO. Without the bucket the
 * attachment and receipt tests fail with `ECONNRESET` — a message that points
 * at the network rather than at the missing bucket, which is why this was easy
 * to mistake for broken infrastructure and hard to act on.
 *
 * Idempotent, and deliberately its own script rather than test setup: the same
 * step is needed by `pnpm dev` against a fresh compose volume.
 */
async function main() {
  const endpoint = process.env["STORAGE_ENDPOINT"] ?? "http://127.0.0.1:9000";
  const bucket = process.env["STORAGE_BUCKET"];

  if (!bucket) {
    throw new Error("STORAGE_BUCKET is not set — nothing to create.");
  }

  const s3 = new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env["STORAGE_ACCESS_KEY"] ?? "minioadmin",
      secretAccessKey: process.env["STORAGE_SECRET_KEY"] ?? "minioadmin",
    },
  });

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`bucket "${bucket}" already exists at ${endpoint}`);
    return;
  } catch {
    // Not there, or not reachable. Creating tells us which.
  }

  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`created bucket "${bucket}" at ${endpoint}`);
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists") {
      console.log(`bucket "${bucket}" already exists at ${endpoint}`);
      return;
    }
    // Say which endpoint failed. "ECONNRESET" on its own sent us looking at the
    // wrong layer for an hour.
    throw new Error(
      `Could not create bucket "${bucket}" at ${endpoint}. Is MinIO running (docker compose up -d)? Cause: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
