import { defineConfig } from 'tsup';

// esbuild drops module-level directives when it bundles, so the 'use client' at the
// top of PracticeInstrument.tsx does not survive into dist/index.js on its own.
// The banner puts it back as the first line of the bundle, which is what Next's
// App Router reads to treat the package as client code.
export default defineConfig({
  banner: { js: "'use client';" },
  external: ['react', 'react-dom'],
});
