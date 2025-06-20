# MCP Mock API Server

A flexible mock API server integrated with Model Context Protocol (MCP) for LLM-controlled API mocking with persistent storage.

## Features

- Create, list, and delete mock endpoints and their `responses` via MCP tools
- Persistent storage of mock endpoints in configurable location
- HTTP server for testing mock endpoints
- MCP integration for LLM-controlled API mocking

## Setup

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build
```

## Usage

### With VS Code MCP

1. Install the VS Code MCP extension
2. The server will start automatically using the configuration in `.vscode/mcp.json`
3. No need to manually start the server when using MCP in VS Code

### Standalone Mode

If you're not using VS Code MCP integration:

```bash
# Run the server manually
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

> **Important:** If the `--storage-path` parameter is not provided, the server will use a `data` directory in the current working directory. If this directory can't be created or accessed, the storage will be ephemeral (in-memory only) and all endpoint data will be lost when the server stops. To ensure data persistence, always specify a valid storage path.

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

In the [`.vscode/mcp.json`](.vscode/mcp.json) file, you can specify both storage path and port:

```json
{
  "servers": {
    "mcp-mock-api": {
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

To change the port, modify the `--port=9090` argument in the MCP configuration.

If no port is provided, the server will use the default port 9090. If no storage path is provided, the server will use a `data` directory in the current working directory.

## MCP Tools

The server exposes these MCP tools for LLM interaction:

- `create_endpoint` - Create or update a mock endpoint
- `list_endpoints` - List all mock endpoints
- `delete_endpoint` - Delete a mock endpoint
- `get_endpoint` - Retrieve details of a specific mock endpoint
