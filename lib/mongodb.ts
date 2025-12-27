import { MongoClient } from "mongodb";

export interface CollectionBackup {
  name: string;
  data: Buffer;
  documentCount: number;
}

export interface MongoDBBackupResult {
  collections: CollectionBackup[];
  totalDocuments: number;
  databaseName: string;
}

export async function backupMongoDB(): Promise<MongoDBBackupResult> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();

    // Extract database name from URI or use default
    const dbName = new URL(uri.replace("mongodb+srv://", "https://")).pathname.slice(1) || "test";
    const db = client.db(dbName);

    // Get all collection names
    const collectionsCursor = await db.listCollections();
    const collectionInfos = await collectionsCursor.toArray();

    const collections: CollectionBackup[] = [];
    let totalDocuments = 0;

    for (const collectionInfo of collectionInfos) {
      const collectionName = collectionInfo.name;

      // Skip system collections
      if (collectionName.startsWith("system.")) {
        continue;
      }

      const collection = db.collection(collectionName);
      const documents = await collection.find({}).toArray();

      const jsonData = JSON.stringify(documents, null, 2);
      const buffer = Buffer.from(jsonData, "utf-8");

      collections.push({
        name: collectionName,
        data: buffer,
        documentCount: documents.length,
      });

      totalDocuments += documents.length;
    }

    return {
      collections,
      totalDocuments,
      databaseName: dbName,
    };
  } finally {
    await client.close();
  }
}
