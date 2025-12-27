import archiver from "archiver";
import { PassThrough } from "stream";
import type { CollectionBackup } from "./mongodb.js";
import type { BlobBackup } from "./blob.js";

export interface ZipResult {
  buffer: Buffer;
  fileName: string;
  totalFiles: number;
  totalSize: number;
}

export async function createBackupZip(
  mongoCollections: CollectionBackup[],
  blobs: BlobBackup[]
): Promise<ZipResult> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();

    passThrough.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    passThrough.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const timestamp = new Date().toISOString().split("T")[0];
      const fileName = `backup-${timestamp}.zip`;

      resolve({
        buffer,
        fileName,
        totalFiles: mongoCollections.length + blobs.length,
        totalSize: buffer.length,
      });
    });

    passThrough.on("error", reject);

    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    archive.on("error", reject);

    archive.pipe(passThrough);

    // Add MongoDB collections
    for (const collection of mongoCollections) {
      archive.append(collection.data, {
        name: `mongodb/${collection.name}.json`,
      });
    }

    // Add blob files
    for (const blob of blobs) {
      // Preserve directory structure from blob pathname
      archive.append(blob.data, {
        name: `blobs/${blob.pathname}`,
      });
    }

    // Add metadata file
    const metadata = {
      createdAt: new Date().toISOString(),
      mongodb: {
        collections: mongoCollections.map((c) => ({
          name: c.name,
          documentCount: c.documentCount,
          sizeBytes: c.data.length,
        })),
      },
      blobs: {
        files: blobs.map((b) => ({
          pathname: b.pathname,
          contentType: b.contentType,
          sizeBytes: b.size,
        })),
      },
    };

    archive.append(JSON.stringify(metadata, null, 2), {
      name: "backup-metadata.json",
    });

    archive.finalize();
  });
}
