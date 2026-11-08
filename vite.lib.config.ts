import { defineConfig } from 'vite';
export default defineConfig({
  publicDir: false,
  define: { global: 'globalThis' },
  // MathJax's source build imports its default font through this private
  // specifier. Map it to STIX Two so the unused NewCM font data is not shipped.
  resolve: { alias: [{ find: /^#default-font\//, replacement: '@mathjax/mathjax-stix2-font/js/' }] },
  build: {
    outDir: 'dist', lib: { entry: { index: 'src/index.ts', node: 'src/node.ts', 'browser-metafile': 'src/browser-metafile.ts' }, formats: ['es', 'cjs'] },
    rolldownOptions: { external: ['node:fs/promises', 'node:child_process', 'node:os', 'node:path', 'node:util', 'fflate', '@xmldom/xmldom', 'emf-converter', '@napi-rs/canvas'] },
  },
});
