import { google } from "googleapis";
import { Readable } from "stream";

export interface UploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  size: number;
}

function bufferToStream(buffer: Buffer): Readable {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

export async function uploadToGoogleDrive(
  zipBuffer: Buffer,
  fileName: string
): Promise<UploadResult> {
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentialsJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set");
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID environment variable is not set");
  }

  // Parse service account credentials
  const credentials = JSON.parse(credentialsJson);

  // Create auth client
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });

  // Upload the file
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: "application/zip",
    },
    media: {
      mimeType: "application/zip",
      body: bufferToStream(zipBuffer),
    },
    fields: "id,name,webViewLink,size",
  });

  const file = response.data;

  if (!file.id) {
    throw new Error("Failed to upload file to Google Drive: no file ID returned");
  }

  return {
    fileId: file.id,
    fileName: file.name || fileName,
    webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    size: parseInt(file.size || "0", 10),
  };
}
