import * as http from "http";
import * as path from "path";
import { z } from "zod";
import { McpServer, ResourceTemplate, } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PersistentStorage } from "./storage.js";
// Get command line arguments
// Usage: node server.js --storage-path=/path/to/storage --port=8080
const args = process.argv.slice(2);
// Parse storage path argument
const storagePathArg = args.find((arg) => arg.startsWith("--storage-path="));
const storagePath = storagePathArg ? storagePathArg.split("=")[1] : undefined;
// Parse port argument
const portArg = args.find((arg) => arg.startsWith("--port="));
let PORT = portArg ? parseInt(portArg.split("=")[1], 10) : 9090;
// Validate port number
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    console.error(`❌ Invalid port number: ${portArg ? portArg.split("=")[1] : PORT}. Using default port 9090.`);
    PORT = 9090;
}
console.error(`📂 Storage path ${storagePath
    ? "set to: " + storagePath
    : "not provided, using default location: " +
        path.join(process.cwd(), "data")}`);
if (!storagePath) {
    console.error("⚠️  WARNING: No storage path specified. If the default location is not accessible, storage will be ephemeral.");
}
console.error(`🌐 Server port ${portArg ? "set to: " + PORT : "using default: " + PORT}`);
// Initialize persistent storage
const storage = new PersistentStorage(storagePath);
// Store for dynamic mock endpoints
let mockEndpoints = {};
// Helper function to save endpoints after changes
async function saveEndpoints() {
    try {
        await storage.saveMockEndpoints(mockEndpoints);
    }
    catch (error) {
        console.error("Failed to persist endpoints:", error);
    }
}
// Load existing endpoints on startup
async function loadEndpoints() {
    try {
        mockEndpoints = await storage.loadMockEndpoints();
    }
    catch (error) {
        console.error("Failed to load existing endpoints:", error);
    }
}
// Helper function to send JSON response
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}
// 1. Instantiate an MCP server with enhanced capabilities
const server = new McpServer({
    name: "mock-api-server",
    version: "1.0.0",
});
// 2. Add dynamic endpoint management tools
server.tool("create_endpoint", "Create or update a mock API endpoint with customizable response and status code", {
    path: z.string().describe("URL path for the endpoint (e.g., /api/users)"),
    method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
    statusCode: z
        .number()
        .optional()
        .default(200)
        .describe("HTTP status code to return"),
    response: z.any().describe("JSON response body to return"),
}, async ({ path, method, statusCode = 200, response }) => {
    const id = `${method}:${path}`;
    mockEndpoints[id] = { method, path, response, statusCode };
    // Persist the changes
    await saveEndpoints();
    return {
        content: [
            {
                type: "text",
                text: `✅ Created/updated mock endpoint: ${method} ${path}\nStatus: ${statusCode}\nTotal endpoints: ${Object.keys(mockEndpoints).length}`,
            },
        ],
    };
});
server.tool("list_endpoints", "List all currently configured mock API endpoints", {}, async () => {
    const endpoints = Object.entries(mockEndpoints).map(([id, data]) => ({
        id,
        method: data.method,
        path: data.path,
        statusCode: data.statusCode,
    }));
    return {
        content: [
            {
                type: "text",
                text: `📋 Mock Endpoints (${endpoints.length}):\n${endpoints
                    .map((e) => `${e.method} ${e.path} → ${e.statusCode}`)
                    .join("\n") || "No endpoints defined"}`,
            },
        ],
    };
});
// Tool to retrieve details of a specific endpoint
server.tool("get_endpoint", "Get details for a configured mock API endpoint", {
    path: z.string().describe("URL path for the endpoint"),
    method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
}, async ({ path, method }) => {
    const id = `${method}:${path}`;
    const endpoint = mockEndpoints[id];
    if (endpoint) {
        return {
            content: [
                {
                    type: "text",
                    text: `ℹ️ Endpoint: ${method} ${path}\nStatus: ${endpoint.statusCode}\nResponse: ${JSON.stringify(endpoint.response, null, 2)}`,
                },
            ],
        };
    }
    else {
        return {
            content: [
                { type: "text", text: `❌ Endpoint not found: ${method} ${path}` },
            ],
        };
    }
});
server.tool("delete_endpoint", "Delete an existing mock API endpoint", {
    path: z.string().describe("URL path for the endpoint to delete"),
    method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
}, async ({ path, method }) => {
    const id = `${method}:${path}`;
    if (mockEndpoints[id]) {
        delete mockEndpoints[id];
        // Persist the changes
        await saveEndpoints();
        return {
            content: [
                {
                    type: "text",
                    text: `🗑️ Deleted endpoint: ${method} ${path}`,
                },
            ],
        };
    }
    else {
        return {
            content: [
                { type: "text", text: `❌ Endpoint not found: ${method} ${path}` },
            ],
        };
    }
});
// 4. Keep the original greeting resource
server.resource("greeting", new ResourceTemplate("greeting://{name}", { list: undefined }), async (uri, { name }) => {
    return {
        contents: [
            {
                uri: uri.href,
                text: `Hello, ${name}!`,
            },
        ],
    };
});
// 5. Set up MCP transport (stdio for LLM communication)
const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
    console.error("Failed to connect MCP server:", err);
});
// 6. Create HTTP server for frontend developers
const httpServer = http.createServer(async (req, res) => {
    const url = req.url || "";
    const method = req.method || "GET";
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }
    try {
        // Check if we have a mock for this endpoint first
        const mockId = `${method}:${url}`;
        if (mockEndpoints[mockId]) {
            const mock = mockEndpoints[mockId];
            sendJSON(res, mock.statusCode, mock.response);
            console.error(`📡 Served mock: ${method} ${url} → ${mock.statusCode}`);
            return;
        }
        // Health check endpoint
        if (url === "/" && method === "GET") {
            sendJSON(res, 200, {
                message: "🚀 Mock API Server is running!",
                serverName: "mock-api-server",
                version: "1.0.0",
                mockedEndpoints: Object.keys(mockEndpoints).length,
                mockEndpoints: Object.entries(mockEndpoints).map(([id, data]) => `${data.method} ${data.path}`),
            });
            return;
        }
        // 404 for unknown endpoints
        sendJSON(res, 404, {
            error: "Not found",
            message: "Endpoint not found. Use MCP tools to create mock endpoints.",
            availableEndpoints: Object.keys(mockEndpoints),
        });
    }
    catch (error) {
        sendJSON(res, 500, {
            error: "Server error",
            details: error.message || "Unknown error",
        });
    }
});
// 7. Start the HTTP server
httpServer.listen(PORT, async () => {
    // Load existing endpoints on startup
    await loadEndpoints();
    console.error(`🚀 Mock API Server running on http://localhost:${PORT}`);
    console.error(`💾 Storage location: ${storage.getStoragePath()}`);
    console.error(`📊 Loaded ${Object.keys(mockEndpoints).length} mock endpoints from storage`);
    console.error(`📝 Built-in endpoints:`);
    console.error(`   GET  http://localhost:${PORT}/                      - Health check`);
    console.error(`\n🧪 Test with curl:`);
    console.error(`   curl http://localhost:${PORT}/`);
    console.error(`\n🤖 MCP Server started (communicating via stdio)`);
    console.error(`💡 LLMs can now use tools to create dynamic mock endpoints!`);
});
//# sourceMappingURL=server.js.map