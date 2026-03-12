import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('Build artifacts', () => {
  beforeAll(() => {
    // Ensure build has run
    execSync('npm run build', { stdio: 'ignore' });
  });

  describe('Main entry point', () => {
    it('generates ESM bundle', () => {
      expect(existsSync(resolve('dist/index.mjs'))).toBe(true);
    });

    it('generates CJS bundle', () => {
      expect(existsSync(resolve('dist/index.cjs'))).toBe(true);
    });

    it('generates TypeScript declarations', () => {
      const hasDts = existsSync(resolve('dist/index.d.ts'));
      const hasDmts = existsSync(resolve('dist/index.d.mts'));
      expect(hasDts || hasDmts).toBe(true);
    });
  });

  describe('Storage subpath', () => {
    it('generates ESM bundle', () => {
      expect(existsSync(resolve('dist/storage/index.mjs'))).toBe(true);
    });

    it('generates CJS bundle', () => {
      expect(existsSync(resolve('dist/storage/index.cjs'))).toBe(true);
    });

    it('generates TypeScript declarations', () => {
      const hasDts = existsSync(resolve('dist/storage/index.d.ts'));
      const hasDmts = existsSync(resolve('dist/storage/index.d.mts'));
      expect(hasDts || hasDmts).toBe(true);
    });
  });

  describe('Types subpath', () => {
    it('generates ESM bundle', () => {
      expect(existsSync(resolve('dist/types/index.mjs'))).toBe(true);
    });

    it('generates CJS bundle', () => {
      expect(existsSync(resolve('dist/types/index.cjs'))).toBe(true);
    });

    it('generates TypeScript declarations', () => {
      const hasDts = existsSync(resolve('dist/types/index.d.ts'));
      const hasDmts = existsSync(resolve('dist/types/index.d.mts'));
      expect(hasDts || hasDmts).toBe(true);
    });
  });

  describe('Errors subpath', () => {
    it('generates ESM bundle', () => {
      expect(existsSync(resolve('dist/errors/index.mjs'))).toBe(true);
    });

    it('generates CJS bundle', () => {
      expect(existsSync(resolve('dist/errors/index.cjs'))).toBe(true);
    });

    it('generates TypeScript declarations', () => {
      const hasDts = existsSync(resolve('dist/errors/index.d.ts'));
      const hasDmts = existsSync(resolve('dist/errors/index.d.mts'));
      expect(hasDts || hasDmts).toBe(true);
    });
  });

  describe('Constants subpath', () => {
    it('generates ESM bundle', () => {
      expect(existsSync(resolve('dist/constants/index.mjs'))).toBe(true);
    });

    it('generates CJS bundle', () => {
      expect(existsSync(resolve('dist/constants/index.cjs'))).toBe(true);
    });

    it('generates TypeScript declarations', () => {
      const hasDts = existsSync(resolve('dist/constants/index.d.ts'));
      const hasDmts = existsSync(resolve('dist/constants/index.d.mts'));
      expect(hasDts || hasDmts).toBe(true);
    });
  });

  describe('Catalog subpath', () => {
    it('generates ESM bundle', () => {
      expect(existsSync(resolve('dist/catalog/index.mjs'))).toBe(true);
    });

    it('generates CJS bundle', () => {
      expect(existsSync(resolve('dist/catalog/index.cjs'))).toBe(true);
    });

    it('generates TypeScript declarations', () => {
      const hasDts = existsSync(resolve('dist/catalog/index.d.ts'));
      const hasDmts = existsSync(resolve('dist/catalog/index.d.mts'));
      expect(hasDts || hasDmts).toBe(true);
    });
  });

  describe('Selection subpath', () => {
    it('generates ESM bundle', () => {
      expect(existsSync(resolve('dist/selection/index.mjs'))).toBe(true);
    });

    it('generates CJS bundle', () => {
      expect(existsSync(resolve('dist/selection/index.cjs'))).toBe(true);
    });

    it('generates TypeScript declarations', () => {
      const hasDts = existsSync(resolve('dist/selection/index.d.ts'));
      const hasDmts = existsSync(resolve('dist/selection/index.d.mts'));
      expect(hasDts || hasDmts).toBe(true);
    });
  });

  describe('Policy subpath', () => {
    it('generates ESM bundle', () => {
      expect(existsSync(resolve('dist/policy/index.mjs'))).toBe(true);
    });

    it('generates CJS bundle', () => {
      expect(existsSync(resolve('dist/policy/index.cjs'))).toBe(true);
    });

    it('generates TypeScript declarations', () => {
      const hasDts = existsSync(resolve('dist/policy/index.d.ts'));
      const hasDmts = existsSync(resolve('dist/policy/index.d.mts'));
      expect(hasDts || hasDmts).toBe(true);
    });
  });
});
