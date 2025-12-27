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

async function fetchWithRetry(
  url: string,
  retries = 3,
  delay = 1000
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      console.warn(`Fetch failed with status ${response.status}, retrying...`);
    } catch (error) {
      console.warn(`Fetch error (attempt ${i + 1}/${retries}):`, error);
      if (i === retries - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

export async function backupBlobs(): Promise<BlobBackupResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN environment variable is not set");
  }

  const blobs: BlobBackup[] = [];
  let totalSize = 0;
  let cursor: string | undefined;

  try {
    // Paginate through all blobs
    do {
      const listResult = await list({
        token,
        cursor,
        limit: 100,
      });

      // Process blobs sequentially to avoid connection issues
      for (const blob of listResult.blobs) {
        // Skip backup files to avoid backing up backups
        if (blob.pathname.startsWith("backups/")) {
          continue;
        }
        try {
          // Download blob content with retry
          const response = await fetchWithRetry(blob.url);

          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          blobs.push({
            pathname: blob.pathname,
            data: buffer,
            contentType: response.headers.get("content-type") || "application/octet-stream",
            size: blob.size,
          });

          totalSize += blob.size;
        } catch (error) {
          console.error(`Failed to download blob: ${blob.pathname}`, error);
          // Continue with other blobs even if one fails
        }
      }

      cursor = listResult.cursor;
    } while (cursor);
  } catch (error) {
    // If listing fails, return empty result (might be empty store or token issue)
    console.error("Failed to list blobs:", error);
    return {
      blobs: [],
      totalSize: 0,
      totalCount: 0,
    };
  }

  return {
    blobs,
    totalSize,
    totalCount: blobs.length,
  };
}
