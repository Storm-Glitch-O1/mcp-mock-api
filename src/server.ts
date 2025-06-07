import * as http from "http";
import { z } from "zod";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const PORT = 9090;

// Store for dynamic mock endpoints
let mockEndpoints: Record<
  string,
  { method: string; path: string; response: any; statusCode: number }
> = {};

// Helper function to parse JSON from request
function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Helper function to send JSON response
function sendJSON(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// 1. Instantiate an MCP server with enhanced capabilities
const server = new McpServer({
  name: "mock-api-server",
  version: "1.0.0",
});

// 2. Add dynamic endpoint management tools
server.tool(
  "create_endpoint",
  {
    path: z.string().describe("URL path for the endpoint (e.g., /api/users)"),
    method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
    statusCode: z
      .number()
      .optional()
      .default(200)
      .describe("HTTP status code to return"),
    response: z.any().describe("JSON response body to return"),
  },
  async ({ path, method, statusCode = 200, response }) => {
    const id = `${method}:${path}`;
    mockEndpoints[id] = { method, path, response, statusCode };

    return {
      content: [
        {
          type: "text",
          text: `✅ Created/updated mock endpoint: ${method} ${path}\nStatus: ${statusCode}\nTotal endpoints: ${
            Object.keys(mockEndpoints).length
          }`,
        },
      ],
    };
  }
);

server.tool("list_endpoints", {}, async () => {
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
        text: `📋 Mock Endpoints (${endpoints.length}):\n${
          endpoints
            .map((e) => `${e.method} ${e.path} → ${e.statusCode}`)
            .join("\n") || "No endpoints defined"
        }`,
      },
    ],
  };
});

server.tool(
  "delete_endpoint",
  {
    path: z.string().describe("URL path for the endpoint to delete"),
    method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
  },
  async ({ path, method }) => {
    const id = `${method}:${path}`;

    if (mockEndpoints[id]) {
      delete mockEndpoints[id];
      return {
        content: [
          { type: "text", text: `🗑️ Deleted endpoint: ${method} ${path}` },
        ],
      };
    } else {
      return {
        content: [
          { type: "text", text: `❌ Endpoint not found: ${method} ${path}` },
        ],
      };
    }
  }
);

// 3. Keep the original add tool
server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => {
  return {
    content: [{ type: "text", text: `Result: ${a + b}` }],
  };
});

// 4. Keep the original greeting resource
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => {
    return {
      contents: [
        {
          uri: uri.href,
          text: `Hello, ${name}!`,
        },
      ],
    };
  }
);

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
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
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
      console.log(`📡 Served mock: ${method} ${url} → ${mock.statusCode}`);
      return;
    }

    // Built-in endpoints if no mock is defined

    // Health check endpoint
    if (url === "/" && method === "GET") {
      sendJSON(res, 200, {
        message: "🚀 Mock API Server is running!",
        serverName: "mock-api-server",
        version: "1.0.0",
        mockedEndpoints: Object.keys(mockEndpoints).length,
        builtInEndpoints: [
          "GET / - Health check",
          "POST /tools/add - Add two numbers",
          "GET /resources/greeting/:name - Get greeting for name",
        ],
        mockEndpoints: Object.entries(mockEndpoints).map(
          ([id, data]) => `${data.method} ${data.path}`
        ),
      });
      return;
    }

    // Add tool endpoint
    if (url === "/tools/add" && method === "POST") {
      try {
        const body = await parseBody(req);

        const schema = z.object({
          a: z.number(),
          b: z.number(),
        });

        const validated = schema.parse(body);
        const result = validated.a + validated.b;

        sendJSON(res, 200, {
          tool: "add",
          input: { a: validated.a, b: validated.b },
          result: result,
          message: `Result: ${result}`,
        });
      } catch (error: any) {
        sendJSON(res, 400, {
          error: "Invalid input",
          details: error.message || "Unknown error",
        });
      }
      return;
    }

    // Greeting resource endpoint
    const greetingMatch = url.match(/^\/resources\/greeting\/(.+)$/);
    if (greetingMatch && method === "GET") {
      const name = decodeURIComponent(greetingMatch[1]);

      sendJSON(res, 200, {
        resource: "greeting",
        uri: `greeting://${name}`,
        text: `Hello, ${name}!`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 404 for unknown endpoints
    sendJSON(res, 404, {
      error: "Not found",
      message:
        "Endpoint not found. Use MCP tools to create mock endpoints or check built-in endpoints.",
      availableEndpoints: Object.keys(mockEndpoints),
    });
  } catch (error: any) {
    sendJSON(res, 500, {
      error: "Server error",
      details: error.message || "Unknown error",
    });
  }
});

// 7. Start the HTTP server
httpServer.listen(PORT, () => {
  console.log(`🚀 Mock API Server running on http://localhost:${PORT}`);
  console.log(`📝 Built-in endpoints:`);
  console.log(
    `   GET  http://localhost:${PORT}/                      - Health check`
  );
  console.log(
    `   POST http://localhost:${PORT}/tools/add             - Add numbers`
  );
  console.log(
    `   GET  http://localhost:${PORT}/resources/greeting/:name - Get greeting`
  );
  console.log(`\n🧪 Test with curl:`);
  console.log(`   curl http://localhost:${PORT}/`);
  console.log(
    `   curl -X POST http://localhost:${PORT}/tools/add -H "Content-Type: application/json" -d '{"a": 5, "b": 3}'`
  );
  console.log(`   curl http://localhost:${PORT}/resources/greeting/Alice`);
  console.log(`\n🤖 MCP Server started (communicating via stdio)`);
  console.log(`💡 LLMs can now use tools to create dynamic mock endpoints!`);
});
