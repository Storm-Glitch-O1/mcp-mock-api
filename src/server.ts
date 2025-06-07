import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 1. Instantiate an MCP server with a name and version.
const server = new McpServer({
  name: "simple-demo",
  version: "1.0.0"
});

// 2. Add a “tool” called “add” that takes two numbers, a and b, and returns their sum.
server.tool(
  "add",
  { a: z.number(), b: z.number() },
  async ({ a, b }) => {
    return {
      content: [
        { type: "text", text: `Result: ${a + b}` }
      ]
    };
  }
);

// 3. Add a “resource” called “greeting” that returns a greeting string for any name.
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => {
    return {
      contents: [
        {
          uri: uri.href,
          text: `Hello, ${name}!`
        }
      ]
    };
  }
);

// 4. Choose a transport (stdio for CLI). This listens on stdin and writes on stdout.
const transport = new StdioServerTransport();
server.connect(transport).catch(err => {
  console.error("Failed to connect MCP server:", err);
});
