import { defineConfig } from 'vite';
export default defineConfig({
  publicDir: false,
  define: { global: 'globalThis' },
  resolve: { alias: [
    { find: '@napi-rs/canvas', replacement: '/src/modules/images/node-canvas-unavailable.ts' },
    { find: '../adapters/node/pdf-renderer.js', replacement: '/src/adapters/browser/node-pdf-unavailable.ts' },
    // MathJax's source build imports its default font through this private
    // specifier. Map it to STIX Two so the unused NewCM font data is not shipped.
    { find: /^#default-font\//, replacement: '@mathjax/mathjax-stix2-font/js/' },
  ] },
  build: { outDir: 'dist', emptyOutDir: false,
    lib: { entry: 'src/index.ts', name: 'DocxConverter', formats: ['es', 'umd'], fileName: format => format === 'es' ? 'docx-converter.browser.js' : 'docx-converter.umd.cjs' },
  },
});
