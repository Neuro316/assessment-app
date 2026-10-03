import { defineConfig } from 'tsup';

// Builds the test files for Node's built-in runner (node --test). Uses the tsup
// already in devDependencies, so the tests need no test framework of their own.
//
// '@neuroprogeny/practice' is pointed at this package's source, so the library
// tests (which read the app's exercises.ts, which imports the package by name)
// test the current code without needing dist/ built first.
export default defineConfig({
  entry: ['test/*.test.ts'],
  format: ['cjs'],
  platform: 'node',
  target: 'node20',
  outDir: '.test-build',
  clean: true,
  dts: false,
  external: ['react', 'react-dom'],
  // tsup strips the node: prefix by default, but node:test exists only with it.
  removeNodeProtocol: false,
  esbuildOptions(options) {
    options.alias = { '@neuroprogeny/practice': './src/index.ts' };
    options.jsx = 'automatic';
  },
});
