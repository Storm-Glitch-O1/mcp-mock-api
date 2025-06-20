import fs from "fs/promises";
import path from "path";
import { MockStorage } from "./types.js";

export class PersistentStorage {
  private storageDir: string;
  private storageFile: string;

  constructor(dataPath?: string) {
    // Use provided path or default to './data' relative to cwd
    this.storageDir = dataPath || path.join(process.cwd(), "data");
    this.storageFile = path.join(this.storageDir, "mockEndpoints.json");

    // Log whether storage will be persistent or possibly ephemeral
    if (!dataPath) {
      console.error(
        `⚠️  Storage path not provided. Using default path: ${this.storageFile}`
      );
      console.error(
        "⚠️  NOTE: If this path is not accessible, storage will be ephemeral (in-memory only)"
      );
    }
  }

  async saveMockEndpoints(endpoints: MockStorage): Promise<void> {
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(this.storageDir, { recursive: true });

      // Write endpoints to file
      await fs.writeFile(
        this.storageFile,
        JSON.stringify(endpoints, null, 2),
        "utf8"
      );

      console.error(`📁 Saved mock endpoints to: ${this.storageFile}`);
    } catch (error) {
      console.error("Failed to save mock endpoints:", error);
      throw error;
    }
  }

  async loadMockEndpoints(): Promise<MockStorage> {
    try {
      const data = await fs.readFile(this.storageFile, "utf8");
      const endpoints = JSON.parse(data) as MockStorage;
      console.error(
        `📂 Loaded ${Object.keys(endpoints).length} mock endpoints from: ${
          this.storageFile
        }`
      );
      return endpoints;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(
          `📁 No existing storage file found at: ${this.storageFile}. Starting with empty endpoints.`
        );
      } else {
        console.error("Failed to load mock endpoints:", error);
      }
      return {};
    }
  }

  getStoragePath(): string {
    return this.storageFile;
  }
}
