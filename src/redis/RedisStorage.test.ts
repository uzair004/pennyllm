import { describe, it, afterAll } from 'vitest';
import { createStorageContractTests } from '../../tests/contracts/storage.contract.js';
import { RedisStorage } from './RedisStorage.js';

// Check if Redis is available before running tests
// Uses default localhost:6379 -- standard dev/CI Redis
let redisAvailable = false;
let testStorage: RedisStorage | null = null;

try {
  // Attempt connection with short timeout
  testStorage = await RedisStorage.create({
    connection: {
      host: '127.0.0.1',
      port: 6379,
      connectTimeout: 1000,
      maxRetriesPerRequest: 0,
      lazyConnect: false,
    },
    prefix: 'pennyllm-test:',
  });
  redisAvailable = true;
  await testStorage.close();
  testStorage = null;
} catch {
  // Redis not available -- tests will be skipped
}

// Conditionally run contract tests
if (redisAvailable) {
  // Use unique prefix per test run to avoid contamination
  const testPrefix = `pennyllm-test-${Date.now()}:`;

  createStorageContractTests('RedisStorage', async () => {
    const storage = await RedisStorage.create({
      connection: {
        host: '127.0.0.1',
        port: 6379,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
      },
      prefix: testPrefix,
    });
    return storage;
  });

  // Cleanup: flush test keys after all tests
  afterAll(async () => {
    // Create a temporary connection to clean up test keys
    try {
      const cleanup = await RedisStorage.create({
        connection: {
          host: '127.0.0.1',
          port: 6379,
          connectTimeout: 1000,
          maxRetriesPerRequest: 0,
        },
        prefix: testPrefix,
      });
      await cleanup.resetAll(); // Deletes all keys with test prefix
      await cleanup.close();
    } catch {
      // Ignore cleanup errors
    }
  });
} else {
  describe('RedisStorage - StorageBackend contract', () => {
    it.skip('Redis not available -- skipping contract tests', () => {
      // This test is skipped when Redis is not running
      // To run: start Redis on localhost:6379
    });
  });
}
