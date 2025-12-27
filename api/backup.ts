import type { VercelRequest, VercelResponse } from "@vercel/node";
import { backupMongoDB } from "../lib/mongodb";
import { backupBlobs } from "../lib/blob";
import { createBackupZip } from "../lib/zip";
import { uploadBackup } from "../lib/backup-storage";

// Extend timeout to 60 seconds for hobby plan
export const config = {
  maxDuration: 60,
};

interface BackupResult {
  success: boolean;
  timestamp: string;
  mongodb?: {
    databaseName: string;
    collections: number;
    totalDocuments: number;
  };
  blobs?: {
    totalFiles: number;
    totalSize: number;
  };
  zip?: {
    fileName: string;
    totalFiles: number;
    totalSize: number;
  };
  backup?: {
    fileId: string;
    fileName: string;
    url: string;
  };
  error?: string;
  durationMs?: number;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const startTime = Date.now();

  // Only allow GET requests (Vercel cron uses GET)
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Verify cron secret for security
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (cronSecret) {
    // Check both Authorization header and Vercel's cron header
    const isVercelCron = req.headers["x-vercel-cron"] === "1";
    const hasValidAuth = authHeader === `Bearer ${cronSecret}`;

    if (!isVercelCron && !hasValidAuth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const result: BackupResult = {
    success: false,
    timestamp: new Date().toISOString(),
  };

  try {
    console.log("Starting backup process...");

    // Step 1: Backup MongoDB
    console.log("Backing up MongoDB...");
    const mongoBackup = await backupMongoDB();
    result.mongodb = {
      databaseName: mongoBackup.databaseName,
      collections: mongoBackup.collections.length,
      totalDocuments: mongoBackup.totalDocuments,
    };
    console.log(
      `MongoDB backup complete: ${mongoBackup.collections.length} collections, ${mongoBackup.totalDocuments} documents`
    );

    // Step 2: Backup Vercel Blobs
    console.log("Backing up Vercel Blobs...");
    const blobBackup = await backupBlobs();
    result.blobs = {
      totalFiles: blobBackup.totalCount,
      totalSize: blobBackup.totalSize,
    };
    console.log(
      `Blob backup complete: ${blobBackup.totalCount} files, ${formatBytes(blobBackup.totalSize)}`
    );

    // Step 3: Create ZIP archive
    console.log("Creating ZIP archive...");
    const zipResult = await createBackupZip(mongoBackup.collections, blobBackup.blobs);
    result.zip = {
      fileName: zipResult.fileName,
      totalFiles: zipResult.totalFiles,
      totalSize: zipResult.totalSize,
    };
    console.log(`ZIP created: ${zipResult.fileName}, ${formatBytes(zipResult.totalSize)}`);

    // Step 4: Upload to Vercel Blob backup store
    console.log("Uploading backup...");
    const uploadResult = await uploadBackup(zipResult.buffer, zipResult.fileName);
    result.backup = {
      fileId: uploadResult.fileId,
      fileName: uploadResult.fileName,
      url: uploadResult.webViewLink,
    };
    console.log(`Backup uploaded: ${uploadResult.webViewLink}`);

    result.success = true;
    result.durationMs = Date.now() - startTime;

    console.log(`Backup completed successfully in ${result.durationMs}ms`);
    res.status(200).json(result);
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error occurred";
    result.durationMs = Date.now() - startTime;

    console.error("Backup failed:", result.error);
    res.status(500).json(result);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
