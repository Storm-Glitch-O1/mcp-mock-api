import fs from "fs/promises";
import path from "path";
export class PersistentStorage {
    constructor(dataPath) {
        // Use provided path or default to './data' relative to cwd
        this.storageDir = dataPath || path.join(process.cwd(), "data");
        this.storageFile = path.join(this.storageDir, "mockEndpoints.json");
    }
    async saveMockEndpoints(endpoints) {
        try {
            // Create directory if it doesn't exist
            await fs.mkdir(this.storageDir, { recursive: true });
            // Write endpoints to file
            await fs.writeFile(this.storageFile, JSON.stringify(endpoints, null, 2), "utf8");
            console.log(`📁 Saved mock endpoints to: ${this.storageFile}`);
        }
        catch (error) {
            console.error("Failed to save mock endpoints:", error);
            throw error;
        }
    }
    async loadMockEndpoints() {
        try {
            const data = await fs.readFile(this.storageFile, "utf8");
            const endpoints = JSON.parse(data);
            console.log(`📂 Loaded ${Object.keys(endpoints).length} mock endpoints from: ${this.storageFile}`);
            return endpoints;
        }
        catch (error) {
            if (error.code === "ENOENT") {
                console.log(`📁 No existing storage file found at: ${this.storageFile}. Starting with empty endpoints.`);
            }
            else {
                console.error("Failed to load mock endpoints:", error);
            }
            return {};
        }
    }
    getStoragePath() {
        return this.storageFile;
    }
}
//# sourceMappingURL=storage.js.map