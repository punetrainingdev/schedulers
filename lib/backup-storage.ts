import { put, del, list } from "@vercel/blob";

export interface UploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  size: number;
}

const MAX_BACKUPS = 7; // Keep last 7 daily backups

export async function uploadBackup(
  zipBuffer: Buffer,
  fileName: string
): Promise<UploadResult> {
  const token = process.env.BACKUP_BLOB_TOKEN;
  if (!token) {
    throw new Error("BACKUP_BLOB_TOKEN environment variable is not set");
  }

  // Upload the backup to dedicated Vercel Blob store
  const blob = await put(fileName, zipBuffer, {
    access: "public",
    token,
    contentType: "application/zip",
  });

  // Clean up old backups (keep only MAX_BACKUPS)
  await cleanupOldBackups(token);

  return {
    fileId: blob.pathname,
    fileName: fileName,
    webViewLink: blob.url,
    size: zipBuffer.length,
  };
}

async function cleanupOldBackups(token: string): Promise<void> {
  try {
    const listResult = await list({ token });

    // Sort by name (which includes date) descending
    const backups = listResult.blobs
      .filter((b) => b.pathname.endsWith(".zip"))
      .sort((a, b) => b.pathname.localeCompare(a.pathname));

    // Delete old backups beyond MAX_BACKUPS
    const toDelete = backups.slice(MAX_BACKUPS);

    for (const backup of toDelete) {
      console.log(`Deleting old backup: ${backup.pathname}`);
      await del(backup.url, { token });
    }
  } catch (error) {
    console.error("Failed to cleanup old backups:", error);
    // Don't throw - cleanup failure shouldn't fail the backup
  }
}
