import * as http from 'http';
import { z } from 'zod';
import { McpServer, ResourceTemplate, } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PersistentStorage } from './storage.js';
const DEFAULT_PORT = 9090;
const DEFAULT_STORAGE_PATH = undefined;
export class MockApiServer {
    constructor(port, storagePath) {
        this.port = port;
        this.mockEndpoints = {};
        // Schemas for tool inputs
        this.createEndpointSchema = z.object({
            path: z.string().describe("URL path for the endpoint (e.g., /api/users)"),
            method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
            statusCode: z.number().optional().default(200).describe("HTTP status code to return"),
            response: z.any().describe("JSON response body to return"),
        });
        this.getEndpointSchema = z.object({
            path: z.string().describe("URL path for the endpoint"),
            method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
        });
        this.deleteEndpointSchema = z.object({
            path: z.string().describe("URL path for the endpoint to delete"),
            method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
        });
        this.storage = new PersistentStorage(storagePath);
        this.mcpServer = this._createMcpServer();
        this.httpServer = this._createHttpServer();
        this.mockEndpoints = {}; // Ensure initialized
    }
    async _saveEndpoints() {
        try {
            await this.storage.saveMockEndpoints(this.mockEndpoints);
        }
        catch (error) {
            console.error("Failed to persist endpoints:", error);
        }
    }
    async loadEndpoints() {
        try {
            this.mockEndpoints = await this.storage.loadMockEndpoints();
            if (!this.mockEndpoints) {
                this.mockEndpoints = {};
            }
            console.error(`📊 Loaded ${Object.keys(this.mockEndpoints).length} mock endpoints from storage: ${this.storage.getStoragePath()}`);
        }
        catch (error) {
            console.error("Failed to load existing endpoints:", error);
            this.mockEndpoints = {};
        }
    }
    // MCP Tool Handler Logic - now as class methods
    async handleCreateEndpoint(input) {
        const id = `${input.method}:${input.path}`;
        this.mockEndpoints[id] = {
            method: input.method,
            path: input.path,
            response: input.response,
            statusCode: input.statusCode // Zod default handles this during parse
        };
        await this._saveEndpoints();
        return {
            isError: false,
            content: [
                { type: 'text', text: `✅ Created/updated mock endpoint: ${input.method} ${input.path}\nStatus: ${input.statusCode}\nTotal endpoints: ${Object.keys(this.mockEndpoints).length}` },
            ],
        };
    }
    async handleListEndpoints() {
        const endpoints = Object.entries(this.mockEndpoints).map(([id, data]) => ({
            id, method: data.method, path: data.path, statusCode: data.statusCode,
        }));
        return {
            isError: false,
            content: [
                { type: 'text', text: `📋 Mock Endpoints (${endpoints.length}):\n${endpoints.map((e) => `${e.method} ${e.path} → ${e.statusCode}`).join('\n') || 'No endpoints defined'}` },
            ],
        };
    }
    async handleGetEndpoint(input) {
        const id = `${input.method}:${input.path}`;
        const endpoint = this.mockEndpoints[id];
        if (endpoint) {
            return {
                isError: false,
                content: [{ type: 'text', text: `ℹ️ Endpoint: ${input.method} ${input.path}\nStatus: ${endpoint.statusCode}\nResponse: ${JSON.stringify(endpoint.response, null, 2)}` }]
            };
        }
        else {
            return {
                isError: true, // Or false, depending on how MCP expects "not found" to be signaled
                content: [{ type: 'text', text: `❌ Endpoint not found: ${input.method} ${input.path}` }]
            };
        }
    }
    async handleDeleteEndpoint(input) {
        const id = `${input.method}:${input.path}`;
        if (this.mockEndpoints[id]) {
            delete this.mockEndpoints[id];
            await this._saveEndpoints();
            return {
                isError: false,
                content: [{ type: 'text', text: `🗑️ Deleted endpoint: ${input.method} ${input.path}` }]
            };
        }
        else {
            return {
                isError: true, // Or false
                content: [{ type: 'text', text: `❌ Endpoint not found: ${input.method} ${input.path}` }]
            };
        }
    }
    _createMcpServer() {
        const server = new McpServer({
            name: 'mock-api-server',
            version: '1.0.0',
        });
        server.tool('create_endpoint', 'Create or update a mock API endpoint', this.createEndpointSchema.shape, this.handleCreateEndpoint.bind(this));
        server.tool('list_endpoints', 'List all currently configured mock API endpoints', z.object({}).shape, this.handleListEndpoints.bind(this)); // Pass shape for empty schema
        server.tool('get_endpoint', 'Get details for a configured mock API endpoint', this.getEndpointSchema.shape, this.handleGetEndpoint.bind(this));
        server.tool('delete_endpoint', 'Delete an existing mock API endpoint', this.deleteEndpointSchema.shape, this.handleDeleteEndpoint.bind(this));
        server.resource("greeting", new ResourceTemplate("greeting://{name}", { list: undefined }), async (uri, { name }) => {
            return { contents: [{ uri: uri.href, text: `Hello, ${name}!` }] };
        });
        return server;
    }
    _createHttpServer() {
        const httpServerInstance = http.createServer(async (req, res) => {
            const url = req.url || '';
            const method = req.method || 'GET';
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            if (method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }
            try {
                const mockId = `${method}:${url}`;
                if (this.mockEndpoints[mockId]) {
                    const mock = this.mockEndpoints[mockId];
                    this._sendJSON(res, mock.statusCode, mock.response);
                    console.error(`📡 Served mock: ${method} ${url} → ${mock.statusCode}`);
                    return;
                }
                if (url === '/' && method === 'GET') {
                    this._sendJSON(res, 200, {
                        message: '🚀 Mock API Server is running!',
                        serverName: 'mock-api-server',
                        version: '1.0.0',
                        mockedEndpoints: Object.keys(this.mockEndpoints).length,
                        mockEndpoints: Object.entries(this.mockEndpoints).map(([id, data]) => `${data.method} ${data.path}`),
                    });
                    return;
                }
                this._sendJSON(res, 404, {
                    error: 'Not found',
                    message: 'Endpoint not found. Use MCP tools to create mock endpoints.',
                    availableEndpoints: Object.keys(this.mockEndpoints),
                });
            }
            catch (error) {
                this._sendJSON(res, 500, { error: 'Server error', details: error.message || 'Unknown error' });
            }
        });
        return httpServerInstance;
    }
    _sendJSON(res, statusCode, data) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }
    async start() {
        await this.loadEndpoints();
        this.httpServer.listen(this.port, () => {
            console.error(`🚀 Mock API Server running on http://localhost:${this.port}`);
            console.error(`💾 Storage location: ${this.storage.getStoragePath()}`);
        });
        const transport = new StdioServerTransport();
        this.mcpServer.connect(transport).catch((err) => {
            console.error('Failed to connect MCP server:', err);
        });
        console.error(`🤖 MCP Server started (communicating via stdio)`);
    }
}
async function main() {
    const args = process.argv.slice(2);
    const storagePathArg = args.find((arg) => arg.startsWith('--storage-path='));
    const storagePath = storagePathArg ? storagePathArg.split('=')[1] : DEFAULT_STORAGE_PATH;
    const portArg = args.find((arg) => arg.startsWith('--port='));
    let port = portArg ? parseInt(portArg.split('=')[1], 10) : DEFAULT_PORT;
    if (isNaN(port) || port < 1 || port > 65535) {
        console.error(`❌ Invalid port number: ${portArg ? portArg.split('=')[1] : port}. Using default port ${DEFAULT_PORT}.`);
        port = DEFAULT_PORT;
    }
    console.error(`📂 Storage path ${storagePath ? 'set to: ' + storagePath : 'using default'}`);
    console.error(`🌐 Server port ${portArg ? 'set to: ' + port : 'using default: ' + port}`);
    const app = new MockApiServer(port, storagePath);
    await app.start();
}
if (require.main === module) {
    main().catch(error => {
        console.error("Error during server startup:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=server.js.map