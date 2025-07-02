import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { PersistentStorage } from './storage.js';
import { MockStorage } from './types.js';

describe('PersistentStorage', () => {
  let tempTestDir: string;
  let storage: PersistentStorage;
  let customStoragePath: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    tempTestDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-mock-api-test-'));
    customStoragePath = path.join(tempTestDir, 'custom-data');
    // Default storage instance for some tests
    storage = new PersistentStorage(customStoragePath);
  });

  afterEach(async () => {
    // Clean up the temporary directory
    if (tempTestDir) {
      await fs.rm(tempTestDir, { recursive: true, force: true });
    }
  });

  test('should save mock endpoints to the specified file path', async () => {
    const endpoints: MockStorage = {
      'GET:/api/test': { method: 'GET', path: '/api/test', response: { message: 'success' }, statusCode: 200 },
    };
    await storage.saveMockEndpoints(endpoints);

    const fileExists = await fs.access(path.join(customStoragePath, 'mockEndpoints.json')).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    const fileContent = await fs.readFile(path.join(customStoragePath, 'mockEndpoints.json'), 'utf8');
    expect(JSON.parse(fileContent)).toEqual(endpoints);
  });

  test('should load mock endpoints from an existing file', async () => {
    const endpoints: MockStorage = {
      'POST:/api/data': { method: 'POST', path: '/api/data', response: { data: 'created' }, statusCode: 201 },
    };
    // Ensure directory exists before saving
    await fs.mkdir(customStoragePath, { recursive: true });
    await fs.writeFile(path.join(customStoragePath, 'mockEndpoints.json'), JSON.stringify(endpoints, null, 2), 'utf8');

    const loadedEndpoints = await storage.loadMockEndpoints();
    expect(loadedEndpoints).toEqual(endpoints);
  });

  test('should return an empty object if the storage file does not exist', async () => {
    // Ensure the directory does not contain the file (it shouldn't by default in a fresh temp dir)
    const loadedEndpoints = await storage.loadMockEndpoints();
    expect(loadedEndpoints).toEqual({});
  });

  test('should use a default "data" directory if no path is provided', async () => {
    // Note: This test will create a 'data' directory in the CWD of the test runner.
    // This might be undesirable for some setups, but it tests the default behavior.
    // For more isolated testing, process.cwd() could be mocked.
    const defaultStorage = new PersistentStorage(); // No path provided
    const defaultPath = path.join(process.cwd(), 'data', 'mockEndpoints.json');

    // Clean up default storage file if it exists from previous runs
    try {
      await fs.unlink(defaultPath);
      await fs.rmdir(path.dirname(defaultPath)); // remove 'data' dir if empty
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error; // Ignore if file/dir doesn't exist
    }

    const endpoints: MockStorage = { 'GET:/api/default': { method: 'GET', path: '/api/default', response: { default: true }, statusCode: 200 }};
    await defaultStorage.saveMockEndpoints(endpoints);

    const fileExists = await fs.access(defaultPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    const loadedEndpoints = await defaultStorage.loadMockEndpoints();
    expect(loadedEndpoints).toEqual(endpoints);

    // Cleanup
    await fs.unlink(defaultPath);
    await fs.rmdir(path.dirname(defaultPath));
  });

  test('getStoragePath should return the full path to the storage file', () => {
    const expectedPath = path.join(customStoragePath, 'mockEndpoints.json');
    expect(storage.getStoragePath()).toBe(expectedPath);
  });

  test('getStoragePath should return default path if none provided in constructor', () => {
    const defaultStorage = new PersistentStorage();
    const expectedPath = path.join(process.cwd(), "data", "mockEndpoints.json");
    expect(defaultStorage.getStoragePath()).toBe(expectedPath);
  });

  test('should return an empty object if the storage file contains invalid JSON', async () => {
    // Ensure directory exists
    await fs.mkdir(customStoragePath, { recursive: true });
    await fs.writeFile(path.join(customStoragePath, 'mockEndpoints.json'), 'this is not json', 'utf8');

    const loadedEndpoints = await storage.loadMockEndpoints();
    expect(loadedEndpoints).toEqual({});
    // Optionally, check console.error was called (requires spyOn console)
  });

  test('saveMockEndpoints should create the directory if it does not exist', async () => {
    const newDirPath = path.join(tempTestDir, 'new-dir-for-storage');
    const storageInNewDir = new PersistentStorage(newDirPath);
    const endpoints: MockStorage = { 'GET:/api/test': { method: 'GET', path: '/api/test', response: { message: 'success' }, statusCode: 200 }};

    await storageInNewDir.saveMockEndpoints(endpoints);

    const fileExists = await fs.access(path.join(newDirPath, 'mockEndpoints.json')).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
  });

});
