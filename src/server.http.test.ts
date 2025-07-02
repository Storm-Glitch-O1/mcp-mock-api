import * as http from 'http';
import { MockApiServer } from './server.js';
import { PersistentStorage } from './storage.js';
import { MockStorage } from './types.js';

// Mock PersistentStorage as it's a dependency of MockApiServer
jest.mock('./storage.js'); // Use .js extension
const MockPersistentStorage = PersistentStorage as jest.MockedClass<typeof PersistentStorage>;
let mockStorageData: MockStorage = {};

MockPersistentStorage.prototype.loadMockEndpoints = jest.fn(async () => {
  return JSON.parse(JSON.stringify(mockStorageData));
});
MockPersistentStorage.prototype.saveMockEndpoints = jest.fn(async (endpoints: MockStorage) => {
  mockStorageData = JSON.parse(JSON.stringify(endpoints));
});
MockPersistentStorage.prototype.getStoragePath = jest.fn(() => '/mock/http-test-storage');

// Minimal mock for StdioServerTransport if its absence causes issues during apiServer.start()
jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: jest.fn().mockImplementation(() => {
      return {
        start: jest.fn(async () => {}),
        stop: jest.fn(async () => {}),
        send: jest.fn(async (message: any) => {}),
        onMessage: jest.fn((callback: (message: any) => void) => {}),
        close: jest.fn(() => {}),
        onClose: jest.fn( (handler: () => void) => {}),
        onError: jest.fn( (handler: (error: Error) => void) => {}),
      };
    }),
  };
});


// Helper to make HTTP requests
function makeRequest(port: number, path: string, method: string = 'GET'): Promise<{ statusCode?: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: method,
    };

    const req = http.request(options, (res) => {
      let rawData = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        rawData += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(rawData);
          resolve({ statusCode: res.statusCode, data: parsedData, headers: res.headers });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: rawData, headers: res.headers });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}


describe('MockApiServer - HTTP Server Functionality', () => {
  let apiServer: MockApiServer;
  let testPort = 9900; // Start port for tests

  beforeEach(async () => {
    mockStorageData = {};
    (MockPersistentStorage.prototype.loadMockEndpoints as jest.Mock).mockClear();
    (MockPersistentStorage.prototype.saveMockEndpoints as jest.Mock).mockClear();

    testPort++;
    apiServer = new MockApiServer(testPort, '/test-storage-http');

    jest.spyOn(console, 'error').mockImplementation(() => {});
    await apiServer.start();
  });

  afterEach(async () => {
    if (apiServer && apiServer.httpServer) {
      // apiServer.httpServer.close() needs to be promisified correctly
      await new Promise<void>((resolve, reject) => {
        apiServer.httpServer.close((err?: Error) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
    (console.error as jest.Mock).mockRestore();
  });

  test('GET / should return health check response', async () => {
    const { statusCode, data } = await makeRequest(testPort, '/');
    expect(statusCode).toBe(200);
    expect(data.message).toBe('🚀 Mock API Server is running!');
    expect(data.serverName).toBe('mock-api-server');
    expect(data.mockedEndpoints).toBe(0);
  });

  test('should serve a defined mock endpoint with correct status and response', async () => {
    apiServer.mockEndpoints['GET:/api/custom'] = {
      method: 'GET',
      path: '/api/custom',
      response: { value: 'mocked data' },
      statusCode: 201,
    };

    const { statusCode, data } = await makeRequest(testPort, '/api/custom', 'GET');
    expect(statusCode).toBe(201);
    expect(data).toEqual({ value: 'mocked data' });
  });

  test('should return 404 for undefined endpoints', async () => {
    const { statusCode, data } = await makeRequest(testPort, '/api/nonexistent', 'GET');
    expect(statusCode).toBe(404);
    expect(data.error).toBe('Not found');
    expect(data.message).toContain('Endpoint not found');
  });

  test('OPTIONS request should return 200 with CORS headers', async () => {
    const { statusCode, headers } = await makeRequest(testPort, '/api/any', 'OPTIONS');
    expect(statusCode).toBe(200);
    expect(headers['access-control-allow-origin']).toBe('*');
    expect(headers['access-control-allow-methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
  });
});
