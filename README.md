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

## Storage Configuration

The mock endpoints are saved to a JSON file that persists between server restarts. You can configure the storage location using:

### Command line argument:

```bash
# Run with custom storage path
node dist/server.js --storage-path=/path/to/storage
```

### VS Code MCP configuration:

In the `.vscode/mcp.json` file, you can specify the storage path:

```json
{
  "servers": {
    "simpleDemo": {
      "type": "stdio",
      "command": "node",
      "args": [
        "${workspaceFolder}/dist/server.js",
        "--storage-path=${workspaceFolder}/mcp-data"
      ]
    }
  }
}
```

If no storage path is provided, the server will use a `data` directory in the current working directory.

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
