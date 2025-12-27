import "dotenv/config";
import { backupMongoDB } from "./lib/mongodb.js";
import { backupBlobs } from "./lib/blob.js";
import { createBackupZip } from "./lib/zip.js";
import { uploadBackup } from "./lib/backup-storage.js";

async function testBackup() {
  console.log("Starting backup test...\n");

  try {
    // Test MongoDB backup
    console.log("1. Testing MongoDB backup...");
    const mongoBackup = await backupMongoDB();
    console.log(`   ✓ Database: ${mongoBackup.databaseName}`);
    console.log(`   ✓ Collections: ${mongoBackup.collections.length}`);
    console.log(`   ✓ Total documents: ${mongoBackup.totalDocuments}`);
    mongoBackup.collections.forEach((c) => {
      console.log(`     - ${c.name}: ${c.documentCount} docs`);
    });
    console.log();

    // Test Blob backup
    console.log("2. Testing Blob backup...");
    const blobBackup = await backupBlobs();
    console.log(`   ✓ Total files: ${blobBackup.totalCount}`);
    console.log(`   ✓ Total size: ${formatBytes(blobBackup.totalSize)}`);
    console.log();

    // Test ZIP creation
    console.log("3. Testing ZIP creation...");
    const zipResult = await createBackupZip(mongoBackup.collections, blobBackup.blobs);
    console.log(`   ✓ File name: ${zipResult.fileName}`);
    console.log(`   ✓ Total files in ZIP: ${zipResult.totalFiles}`);
    console.log(`   ✓ ZIP size: ${formatBytes(zipResult.totalSize)}`);
    console.log();

    // Test Backup upload
    console.log("4. Testing backup upload to Vercel Blob...");
    const uploadResult = await uploadBackup(zipResult.buffer, zipResult.fileName);
    console.log(`   ✓ File ID: ${uploadResult.fileId}`);
    console.log(`   ✓ File name: ${uploadResult.fileName}`);
    console.log(`   ✓ Download URL: ${uploadResult.webViewLink}`);
    console.log();

    console.log("✅ All tests passed! Backup completed successfully.");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

testBackup();
