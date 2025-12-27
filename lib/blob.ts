import { list } from "@vercel/blob";

export interface BlobBackup {
  pathname: string;
  data: Buffer;
  contentType: string;
  size: number;
}

export interface BlobBackupResult {
  blobs: BlobBackup[];
  totalSize: number;
  totalCount: number;
}

export async function backupBlobs(): Promise<BlobBackupResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN environment variable is not set");
  }

  const blobs: BlobBackup[] = [];
  let totalSize = 0;
  let cursor: string | undefined;

  // Paginate through all blobs
  do {
    const listResult = await list({
      token,
      cursor,
      limit: 100,
    });

    for (const blob of listResult.blobs) {
      // Download blob content
      const response = await fetch(blob.url);
      if (!response.ok) {
        console.error(`Failed to download blob: ${blob.pathname}`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      blobs.push({
        pathname: blob.pathname,
        data: buffer,
        contentType: response.headers.get("content-type") || "application/octet-stream",
        size: blob.size,
      });

      totalSize += blob.size;
    }

    cursor = listResult.cursor;
  } while (cursor);

  return {
    blobs,
    totalSize,
    totalCount: blobs.length,
  };
}
