// src/server.mcp.test.ts
import { PersistentStorage } from './storage.js';
import { MockStorage, CreateEndpointInput, GetEndpointInput, DeleteEndpointInput } from './types.js'; // Import inferred types
import { MockApiServer } from './server.js';
import { z } from 'zod';

// Mock PersistentStorage (same as before)
jest.mock('./storage');
const MockPersistentStorage = PersistentStorage as jest.MockedClass<typeof PersistentStorage>;
let mockStorageData: MockStorage = {};

MockPersistentStorage.prototype.loadMockEndpoints = jest.fn(async () => {
  return JSON.parse(JSON.stringify(mockStorageData));
});
MockPersistentStorage.prototype.saveMockEndpoints = jest.fn(async (endpoints: MockStorage) => {
  mockStorageData = JSON.parse(JSON.stringify(endpoints));
});
MockPersistentStorage.prototype.getStoragePath = jest.fn(() => '/mock/storage/path');

// StdioServerTransport is not directly used by these handler tests, so no deep mock needed.
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');


describe('MockApiServer - MCP Tool Handler Tests', () => {
  let apiServer: MockApiServer;

  beforeEach(async () => {
    mockStorageData = {};
    (MockPersistentStorage.prototype.loadMockEndpoints as jest.Mock).mockClear();
    (MockPersistentStorage.prototype.saveMockEndpoints as jest.Mock).mockClear();

    apiServer = new MockApiServer(9999, '/test-storage');
    // Initialize mockEndpoints by calling loadEndpoints (as done in apiServer.start())
    await apiServer.loadEndpoints();
  });

  describe('handleCreateEndpoint', () => {
    test('should add an endpoint and trigger save', async () => {
      const input: CreateEndpointInput = {
        path: '/api/mcp/test',
        method: 'GET',
        statusCode: 201,
        response: { success: true }
      };
      // No need to parse with schema here if type is already CreateEndpointInput & valid
      // const parsedInput = apiServer.createEndpointSchema.parse(input);

      const responseContent = await apiServer.handleCreateEndpoint(input);

      expect(responseContent.content[0].type).toBe('text');
      expect(responseContent.content[0].text).toContain('✅ Created/updated mock endpoint: GET /api/mcp/test');
      expect(responseContent.content[0].text).toContain('Status: 201');
      expect(responseContent.content[0].text).toContain('Total endpoints: 1');

      expect(apiServer.mockEndpoints['GET:/api/mcp/test']).toEqual({
        method: 'GET',
        path: '/api/mcp/test',
        response: { success: true },
        statusCode: 201,
      });
      expect(MockPersistentStorage.prototype.saveMockEndpoints).toHaveBeenCalledTimes(1);
      expect(mockStorageData['GET:/api/mcp/test']).toBeDefined();
    });

    test('should use default status code 200 if not provided', async () => {
      const input = {
        path: '/api/mcp/defaultstatus',
        method: 'POST' as const,
        response: { data: 'some data' }
      };
      // Use Zod schema from the instance to parse and apply defaults
      const parsedInput = apiServer.createEndpointSchema.parse(input);

      const responseContent = await apiServer.handleCreateEndpoint(parsedInput);
      expect(responseContent.content[0].text).toContain('Status: 200');
      expect(apiServer.mockEndpoints['POST:/api/mcp/defaultstatus']?.statusCode).toBe(200);
    });
  });

  describe('handleListEndpoints', () => {
    test('should return currently defined endpoints', async () => {
      apiServer.mockEndpoints = {
        'GET:/api/item1': { method: 'GET', path: '/api/item1', response: { name: 'item1' }, statusCode: 200 },
        'POST:/api/item2': { method: 'POST', path: '/api/item2', response: { name: 'item2' }, statusCode: 201 },
      };
      (MockPersistentStorage.prototype.saveMockEndpoints as jest.Mock).mockClear();

      const responseContent = await apiServer.handleListEndpoints();

      const responseText = responseContent.content[0].text;
      expect(responseText).toContain('📋 Mock Endpoints (2):');
      expect(responseText).toContain('GET /api/item1 → 200');
      expect(responseText).toContain('POST /api/item2 → 201');
      expect(MockPersistentStorage.prototype.saveMockEndpoints).not.toHaveBeenCalled();
    });

    test('should return "No endpoints defined" when empty', async () => {
      apiServer.mockEndpoints = {}; // Ensure it's empty
      const emptyListResponse = await apiServer.handleListEndpoints();
      expect(emptyListResponse.content[0].text).toContain('No endpoints defined');
    });
  });

  describe('handleGetEndpoint', () => {
    test('should retrieve a specific endpoint', async () => {
      apiServer.mockEndpoints = {
        'GET:/api/specific': { method: 'GET', path: '/api/specific', response: { detail: 'some data' }, statusCode: 200 }
      };
      const input: GetEndpointInput = { path: '/api/specific', method: 'GET' };
      const responseContent = await apiServer.handleGetEndpoint(input);

      const responseText = responseContent.content[0].text;
      expect(responseText).toContain('ℹ️ Endpoint: GET /api/specific');
      expect(responseText).toContain('Status: 200');
      expect(responseText).toContain(JSON.stringify({ detail: 'some data' }, null, 2));
    });

    test('should return "Endpoint not found" for non-existent endpoint', async () => {
      const notFoundInput: GetEndpointInput = { path: '/api/nonexistent', method: 'POST' };
      const notFoundResponse = await apiServer.handleGetEndpoint(notFoundInput);
      expect(notFoundResponse.content[0].text).toContain('❌ Endpoint not found: POST /api/nonexistent');
    });
  });

  describe('handleDeleteEndpoint', () => {
    test('should remove an endpoint and trigger save', async () => {
      apiServer.mockEndpoints = {
        'DELETE:/api/removeme': { method: 'DELETE', path: '/api/removeme', response: {}, statusCode: 204 }
      };
      mockStorageData = JSON.parse(JSON.stringify(apiServer.mockEndpoints));
      (MockPersistentStorage.prototype.saveMockEndpoints as jest.Mock).mockClear();

      const input: DeleteEndpointInput = { path: '/api/removeme', method: 'DELETE' };
      const responseContent = await apiServer.handleDeleteEndpoint(input);

      expect(responseContent.content[0].text).toContain('🗑️ Deleted endpoint: DELETE /api/removeme');
      expect(apiServer.mockEndpoints['DELETE:/api/removeme']).toBeUndefined();
      expect(MockPersistentStorage.prototype.saveMockEndpoints).toHaveBeenCalledTimes(1);
      expect(mockStorageData['DELETE:/api/removeme']).toBeUndefined();
    });

    test('should return "Endpoint not found" and not save for non-existent endpoint', async () => {
      const notFoundInput: DeleteEndpointInput = { path: '/api/nonexistent', method: 'GET' };
      (MockPersistentStorage.prototype.saveMockEndpoints as jest.Mock).mockClear();
      const notFoundResponse = await apiServer.handleDeleteEndpoint(notFoundInput);
      expect(notFoundResponse.content[0].text).toContain('❌ Endpoint not found: GET /api/nonexistent');
      expect(MockPersistentStorage.prototype.saveMockEndpoints).not.toHaveBeenCalled();
    });
  });
});
