import { afterEach } from 'vitest';
import { createStorageContractTests } from '../../tests/contracts/storage.contract.js';
import { SqliteStorage } from './SqliteStorage.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Use temp directory for each test run to avoid cross-test contamination
let tempDir: string;

// Run all 10 contract tests
createStorageContractTests('SqliteStorage', async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'pennyllm-sqlite-test-'));
  const dbPath = join(tempDir, 'test.db');
  return SqliteStorage.create({ path: dbPath });
});

// Cleanup temp dirs after each test
afterEach(() => {
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
});
