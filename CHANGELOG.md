# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-06-07

### Added
- Initial public release of MCP Mock API Server
- MCP integration for LLM-controlled API mocking
- Persistent storage of mock endpoints with configurable storage path
- HTTP server for testing mock endpoints with configurable port
- Three main MCP tools:
  - `create_endpoint` - Create or update mock endpoints
  - `list_endpoints` - List all mock endpoints  
  - `delete_endpoint` - Delete mock endpoints
- VS Code MCP integration support
- Comprehensive documentation and setup instructions
- MIT License
- TypeScript support with proper type definitions

### Technical Details
- Built with TypeScript and Express.js
- Uses Model Context Protocol SDK v1.12.1
- Supports both standalone and VS Code MCP integration modes
- Configurable via command line arguments or MCP configuration
- Persistent JSON storage for mock endpoint data
