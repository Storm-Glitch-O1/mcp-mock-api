# Hello MCP - Mock API Server

A simple mock API server using Model Context Protocol (MCP) with persistent storage.

## Features

- Create, list, and delete mock endpoints
- Persistent storage of mock endpoints in configurable location
- HTTP server for testing mock endpoints
- MCP server for LLM integration

## Setup

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run the server
pnpm start
```

## Configuration

### Storage Path

The mock endpoints are saved to a JSON file that persists between server restarts. You can configure the storage location using:

#### Command line argument:

```bash
# Run with custom storage path
node dist/server.js --storage-path=/path/to/storage
```

### Server Port

The HTTP server runs on port 9090 by default. You can override this using:

#### Command line argument:

```bash
# Run with custom port
node dist/server.js --port=8080

# Combine storage path and port
node dist/server.js --storage-path=/path/to/storage --port=3000
```

### VS Code MCP configuration:

In the `.vscode/mcp.json` file, you can specify both storage path and port:

```json
{
  "servers": {
    "simpleDemo": {
      "type": "stdio",
      "command": "node",
      "args": [
        "${workspaceFolder}/dist/server.js",
        "--storage-path=${workspaceFolder}/mcp-data",
        "--port=9090"
      ]
    }
  }
}
```

If no port is provided, the server will use the default port 9090. If no storage path is provided, the server will use a `data` directory in the current working directory.

## Usage

### Built-in Endpoints

- `GET /` - Health check
- `POST /tools/add` - Add two numbers
- `GET /resources/greeting/:name` - Get greeting for name

### MCP Tools

- `create_endpoint` - Create a mock endpoint
- `list_endpoints` - List all mock endpoints
- `delete_endpoint` - Delete a mock endpoint
- `add` - Add two numbers
