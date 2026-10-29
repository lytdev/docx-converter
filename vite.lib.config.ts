import { defineConfig } from 'vite';
export default defineConfig({
  publicDir: false,
  define: { global: 'globalThis' },
  build: {
    outDir: 'dist', lib: { entry: { index: 'src/index.ts', node: 'src/node.ts', 'browser-metafile': 'src/browser-metafile.ts' }, formats: ['es', 'cjs'] },
    rolldownOptions: { external: ['node:fs/promises', 'node:child_process', 'node:os', 'node:path', 'node:util', 'fflate', '@xmldom/xmldom', 'emf-converter', '@napi-rs/canvas'] },
  },
});
