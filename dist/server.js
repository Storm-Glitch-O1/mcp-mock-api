"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
// 1. Instantiate an MCP server with a name and version.
const server = new mcp_js_1.McpServer({
    name: "simple-demo",
    version: "1.0.0"
});
// 2. Add a “tool” called “add” that takes two numbers, a and b, and returns their sum.
server.tool("add", { a: zod_1.z.number(), b: zod_1.z.number() }, async ({ a, b }) => {
    return {
        content: [
            { type: "text", text: `Result: ${a + b}` }
        ]
    };
});
// 3. Add a “resource” called “greeting” that returns a greeting string for any name.
server.resource("greeting", new mcp_js_1.ResourceTemplate("greeting://{name}", { list: undefined }), async (uri, { name }) => {
    return {
        contents: [
            {
                uri: uri.href,
                text: `Hello, ${name}!`
            }
        ]
    };
});
// 4. Choose a transport (stdio for CLI). This listens on stdin and writes on stdout.
const transport = new stdio_js_1.StdioServerTransport();
server.connect(transport).catch(err => {
    console.error("Failed to connect MCP server:", err);
});
