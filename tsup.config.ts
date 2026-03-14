import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/storage/index.ts',
    'src/catalog/index.ts',
    'src/selection/index.ts',
    'src/policy/index.ts',
    'src/types/index.ts',
    'src/errors/index.ts',
    'src/constants/index.ts',
    'src/wrapper/index.ts',
    'src/sqlite/index.ts',
    'src/redis/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  outExtension: ({ format }) => ({
    js: format === 'cjs' ? '.cjs' : '.mjs',
  }),
});
